const mongoose = require("mongoose");
const ChannelTask = require("../models/ChannelTask");
const TaskCounter = require("../models/TaskCounter");
const Channel = require("../models/Channels");
const ChannelMessage = require("../models/ChannelMessage");
const Notification = require("../models/Notifications");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const { getIo, onlineUsers, triggerSoftRefresh } = require("../utils/socket");

const VALID_STATUSES = ["Assigned", "Acknowledged", "Completed"];

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveUserEntity = async (id) => {
  if (!id) return null;
  return (
    (await User.findById(id)) ||
    (await Admin.findById(id)) ||
    (await Client.findById(id))
  );
};

const resolveUsersMap = async (ids = []) => {
  const objectIds = ids
    .filter(Boolean)
    .map((id) => id.toString());
  if (objectIds.length === 0) return {};

  const [users, admins, clients] = await Promise.all([
    User.find({ _id: { $in: objectIds } }, "_id name email").lean(),
    Admin.find({ _id: { $in: objectIds } }, "_id name email").lean(),
    Client.find({ _id: { $in: objectIds } }, "_id name email").lean(),
  ]);

  const map = {};
  [...users, ...admins, ...clients].forEach((entity) => {
    map[entity._id.toString()] = entity;
  });
  return map;
};

const formatTaskNumber = (seq) => `TASK-${String(seq).padStart(4, "0")}`;

const getNextTaskNumber = async () => {
  const counter = await TaskCounter.findOneAndUpdate(
    { _id: "channel_task" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return formatTaskNumber(counter.seq);
};

const isChannelMember = (channel, userId) => {
  if (!channel || !userId) return false;
  const targetId = userId.toString();
  if (channel.owner?.toString() === targetId) return true;
  return (channel.members || []).some((memberId) => memberId?.toString() === targetId);
};

const getAccessibleChannel = async (channelId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) return null;
  const channel = await Channel.findById(channelId).lean();
  if (!channel) return null;
  if (!isChannelMember(channel, userId)) return null;
  return channel;
};

const getAdminIdsForChannel = async (channel) => {
  const admins = await Admin.find({}, "_id").lean();
  if (admins.length === 0) return [];
  const memberSet = new Set((channel.members || []).map((id) => id?.toString()));
  const inChannelAdmins = admins
    .map((admin) => admin?._id?.toString())
    .filter((id) => id && memberSet.has(id));
  if (inChannelAdmins.length > 0) return inChannelAdmins;
  return admins.map((admin) => admin._id.toString());
};

const emitUserNotifications = async ({
  userIds = [],
  title,
  description,
  type,
  sender = null,
}) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
  if (uniqueIds.length === 0) return [];

  const notificationDocs = await Notification.insertMany(
    uniqueIds.map((id) => ({
      userId: id,
      title,
      description,
      type,
      sender,
    }))
  );

  const io = getIo();
  const deliveredIds = [];
  uniqueIds.forEach((userId, idx) => {
    const socketId = onlineUsers.get(userId);
    if (!socketId) return;
    const doc = notificationDocs[idx];
    io.to(socketId).emit("receive-notification", {
      title: doc.title,
      description: doc.description,
      type: doc.type,
      sender: doc.sender,
      timestamp: doc.createdAt,
    });
    deliveredIds.push(doc._id);
  });

  if (deliveredIds.length > 0) {
    await Notification.updateMany(
      { _id: { $in: deliveredIds } },
      { $set: { isRead: true } }
    );
  }

  return notificationDocs;
};

const postSystemMessage = async (channelId, message) => {
  const systemMessage = await ChannelMessage.create({
    channelId,
    sender: null,
    isSystem: true,
    systemLabel: "System",
    message,
  });
  const io = getIo();
  io.to(channelId.toString()).emit("new-channel-message", systemMessage);
  return systemMessage;
};

const mapTasksWithUsers = async (tasks = []) => {
  const ids = new Set();
  tasks.forEach((task) => {
    if (task?.assignedTo) ids.add(task.assignedTo.toString());
    if (task?.createdBy) ids.add(task.createdBy.toString());
  });

  const usersMap = await resolveUsersMap([...ids]);
  return tasks.map((task) => {
    const assignedToId = task.assignedTo?.toString();
    const createdById = task.createdBy?.toString();
    return {
      ...task,
      isOverdue:
        task.status !== "Completed" &&
        new Date(task.deadline).getTime() < Date.now(),
      assignedToUser: assignedToId ? usersMap[assignedToId] || null : null,
      createdByUser: createdById ? usersMap[createdById] || null : null,
    };
  });
};

const buildTaskQuery = ({ channelId, search, status, month, assignedTo }) => {
  const query = { channelId };

  if (search?.trim()) {
    const term = escapeRegex(search.trim());
    query.$or = [
      { title: { $regex: term, $options: "i" } },
      { taskNumber: { $regex: term, $options: "i" } },
    ];
  }

  if (status && VALID_STATUSES.includes(status)) {
    query.status = status;
  }

  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
    query.assignedTo = assignedTo;
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
    query.deadline = { $gte: start, $lte: end };
  }

  return query;
};

const checkAndMarkOverdueTasks = async (channelId = null) => {
  const now = new Date();
  const query = {
    status: { $ne: "Completed" },
    deadline: { $lt: now },
    overdueNotified: false,
  };
  if (channelId) {
    query.channelId = channelId;
  }

  const overdueTasks = await ChannelTask.find(query).lean();
  if (overdueTasks.length === 0) return 0;

  const channelIds = [...new Set(overdueTasks.map((task) => task.channelId.toString()))];
  const channels = await Channel.find({ _id: { $in: channelIds } }).lean();
  const channelMap = {};
  channels.forEach((channel) => {
    channelMap[channel._id.toString()] = channel;
  });

  const adminCache = {};
  for (const task of overdueTasks) {
    const taskChannelId = task.channelId.toString();
    const channel = channelMap[taskChannelId];
    if (!channel) continue;

    if (!adminCache[taskChannelId]) {
      adminCache[taskChannelId] = await getAdminIdsForChannel(channel);
    }
    const adminIds = adminCache[taskChannelId];

    if (adminIds.length > 0) {
      await emitUserNotifications({
        userIds: adminIds,
        title: channel.name || "Channel",
        description: `Task ${task.taskNumber} is overdue.`,
        type: "TASK_OVERDUE",
        sender: channel._id,
      });
    }

    await postSystemMessage(channel._id, `Task ${task.taskNumber} is now overdue.`);
    await ChannelTask.updateOne(
      { _id: task._id },
      { $set: { overdueNotified: true } }
    );
    getIo().to(taskChannelId).emit("task-updated", {
      type: "TASK_OVERDUE",
      channelId: taskChannelId,
      taskId: task._id,
    });
  }

  await triggerSoftRefresh("TASK");
  return overdueTasks.length;
};

const getChannelTasks = async (req, res) => {
  try {
    const { channelId } = req.params;
    const requesterId = req.user?.userId;

    const channel = await getAccessibleChannel(channelId, requesterId);
    if (!channel) {
      return res.status(403).json({ success: false, message: "Not authorized for this channel" });
    }

    await checkAndMarkOverdueTasks(channelId);

    const { search = "", status = "", month = "", assignedTo = "" } = req.query;
    const query = buildTaskQuery({
      channelId: channel._id,
      search,
      status,
      month,
      assignedTo,
    });

    const tasks = await ChannelTask.find(query)
      .sort({ deadline: 1, createdAt: -1 })
      .lean();

    const mappedTasks = await mapTasksWithUsers(tasks);
    res.status(200).json({ success: true, tasks: mappedTasks });
  } catch (error) {
    console.error("Error fetching channel tasks:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const createChannelTask = async (req, res) => {
  try {
    const { channelId } = req.params;
    const requesterId = req.user?.userId;
    const { title, description = "", deadline, assignedTo } = req.body;

    const channel = await getAccessibleChannel(channelId, requesterId);
    if (!channel) {
      return res.status(403).json({ success: false, message: "Not authorized for this channel" });
    }

    if (!title?.trim() || !deadline || !assignedTo) {
      return res.status(400).json({ success: false, message: "title, deadline and assignedTo are required" });
    }

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid deadline" });
    }

    const memberSet = new Set((channel.members || []).map((id) => id?.toString()));
    memberSet.add(channel.owner?.toString());
    if (!memberSet.has(assignedTo?.toString())) {
      return res.status(400).json({ success: false, message: "assignedTo must be a channel member" });
    }

    const [taskNumber, creator, assignee] = await Promise.all([
      getNextTaskNumber(),
      resolveUserEntity(requesterId),
      resolveUserEntity(assignedTo),
    ]);
    const creatorName = creator?.name || "User";
    const assigneeName = assignee?.name || "User";

    const createdTask = await ChannelTask.create({
      channelId: channel._id,
      taskNumber,
      title: title.trim(),
      description: description?.trim() || "",
      deadline: deadlineDate,
      assignedTo,
      createdBy: requesterId,
      status: "Assigned",
    });

    await postSystemMessage(channel._id, `Task ${taskNumber} created by ${creatorName}.`);
    await postSystemMessage(channel._id, `Task ${taskNumber} assigned to ${assigneeName}.`);

    if (assignedTo?.toString() !== requesterId?.toString()) {
      await emitUserNotifications({
        userIds: [assignedTo],
        title: channel.name || "Channel",
        description: `Task ${taskNumber} assigned to you by ${creatorName}.`,
        type: "TASK_ASSIGNED",
        sender: channel._id,
      });
    }

    await checkAndMarkOverdueTasks(channel._id);
    await triggerSoftRefresh("TASK");
    getIo().to(channel._id.toString()).emit("task-updated", {
      type: "TASK_CREATED",
      channelId: channel._id,
      taskId: createdTask._id,
    });

    const mapped = await mapTasksWithUsers([createdTask.toObject()]);
    res.status(201).json({ success: true, task: mapped[0] });
  } catch (error) {
    console.error("Error creating channel task:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const updateChannelTask = async (req, res) => {
  try {
    const { channelId, taskId } = req.params;
    const requesterId = req.user?.userId;
    const { title, description, deadline, assignedTo, status } = req.body;

    const channel = await getAccessibleChannel(channelId, requesterId);
    if (!channel) {
      return res.status(403).json({ success: false, message: "Not authorized for this channel" });
    }

    const task = await ChannelTask.findOne({ _id: taskId, channelId: channel._id });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const previousAssignedTo = task.assignedTo?.toString();
    const previousStatus = task.status;
    const previousDeadline = task.deadline ? new Date(task.deadline).getTime() : null;

    if (title !== undefined) {
      if (!title?.trim()) {
        return res.status(400).json({ success: false, message: "title cannot be empty" });
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description?.trim() || "";
    }

    if (deadline !== undefined) {
      const parsedDeadline = new Date(deadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid deadline" });
      }
      task.deadline = parsedDeadline;
      if (parsedDeadline.getTime() >= Date.now()) {
        task.overdueNotified = false;
      }
    }

    if (assignedTo !== undefined) {
      const memberSet = new Set((channel.members || []).map((id) => id?.toString()));
      memberSet.add(channel.owner?.toString());
      if (!memberSet.has(assignedTo?.toString())) {
        return res.status(400).json({ success: false, message: "assignedTo must be a channel member" });
      }
      task.assignedTo = assignedTo;
      if (task.status === "Completed") {
        task.status = "Assigned";
        task.completedAt = null;
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      task.status = status;
      if (status === "Completed") {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }
    }

    await task.save();

    const [actor, assignee] = await Promise.all([
      resolveUserEntity(requesterId),
      resolveUserEntity(task.assignedTo),
    ]);
    const actorName = actor?.name || "User";
    const assigneeName = assignee?.name || "User";

    if (assignedTo !== undefined && previousAssignedTo !== task.assignedTo?.toString()) {
      await postSystemMessage(
        channel._id,
        `Task ${task.taskNumber} assigned to ${assigneeName}.`
      );
      if (task.assignedTo?.toString() !== requesterId?.toString()) {
        await emitUserNotifications({
          userIds: [task.assignedTo],
          title: channel.name || "Channel",
          description: `Task ${task.taskNumber} assigned to you by ${actorName}.`,
          type: "TASK_ASSIGNED",
          sender: channel._id,
        });
      }
    }

    if (
      deadline !== undefined &&
      previousDeadline !== new Date(task.deadline).getTime()
    ) {
      await postSystemMessage(
        channel._id,
        `Task ${task.taskNumber} deadline updated by ${actorName}.`
      );
    }

    if (status !== undefined && previousStatus !== task.status) {
      if (task.status === "Completed") {
        const adminIds = await getAdminIdsForChannel(channel);
        if (adminIds.length > 0) {
          await emitUserNotifications({
            userIds: adminIds,
            title: channel.name || "Channel",
            description: `Task ${task.taskNumber} marked as completed by ${actorName}.`,
            type: "TASK_COMPLETED",
            sender: channel._id,
          });
        }
        await postSystemMessage(channel._id, `Task ${task.taskNumber} marked as completed.`);
      } else {
        await postSystemMessage(
          channel._id,
          `Task ${task.taskNumber} status updated to ${task.status.toLowerCase()}.`
        );
      }
    }

    await checkAndMarkOverdueTasks(channel._id);
    await triggerSoftRefresh("TASK");
    getIo().to(channel._id.toString()).emit("task-updated", {
      type: "TASK_UPDATED",
      channelId: channel._id,
      taskId: task._id,
    });

    const mapped = await mapTasksWithUsers([task.toObject()]);
    res.status(200).json({ success: true, task: mapped[0] });
  } catch (error) {
    console.error("Error updating channel task:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  getChannelTasks,
  createChannelTask,
  updateChannelTask,
  checkAndMarkOverdueTasks,
};
