const Notification = require("../models/Notifications");
const { emitToUser, isUserOnline } = require("./socket");
const { sendPush } = require("./pushNotification");
const sendMail = require("../services/sendMail");

/**
 * One shared path for "notify a list of users about something" — used by
 * task events, concern submissions, callback creation, etc.
 *
 * Important fix baked in here: push notifications fire for EVERY recipient
 * who has an fcmToken, regardless of whether their socket shows "online".
 * The earlier per-controller versions of this only pushed when offline —
 * that's correct for web (an open tab already sees the live update so a
 * push would be redundant) but wrong for mobile, where the socket can
 * stay connected while the app is backgrounded. A mobile user sitting on
 * a different screen, or with the app closed, still needs the push even
 * though their last-known socket state says "online". Email stays
 * offline-only, since that one *is* purely a "you might have missed this"
 * channel and doesn't need to double up on an actively-used session.
 *
 * @param {object} params
 * @param {string[]} params.userIds - recipient user/admin ids
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.type - notification type tag (e.g. "TASK", "CONCERN", "CALLBACK")
 * @param {string|null} params.sender - id of whoever triggered this, if any
 * @param {object} params.pushData - extra string-keyed data payload for the push (e.g. { screen: "task", taskId })
 * @param {Map<string,object>} params.resolvedEntities - optional pre-resolved {userId: entity} map (avoids redundant DB lookups when the caller already has them)
 */
const notifyUsers = async ({
  userIds = [],
  title,
  description,
  type,
  sender = null,
  pushData = {},
  resolvedEntities = null,
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

  const User = require("../models/User");
  const Admin = require("../models/Admin");
  const Client = require("../models/Client");
  const resolveEntity = async (id) => {
    if (resolvedEntities?.has(id)) return resolvedEntities.get(id);
    const user = await User.findById(id);
    if (user) return { ...user.toObject(), _resolvedType: "employee" };
    const admin = await Admin.findById(id);
    if (admin) return { ...admin.toObject(), _resolvedType: "admin" };
    const client = await Client.findById(id);
    if (client) return { ...client.toObject(), _resolvedType: "client" };
    return null;
  };

  const deliveredIds = [];
  await Promise.all(
    uniqueIds.map(async (userId, idx) => {
      const doc = notificationDocs[idx];
      const online = isUserOnline(userId);

      if (online) {
        emitToUser(userId, "receive-notification", {
          title: doc.title,
          description: doc.description,
          type: doc.type,
          sender: doc.sender,
          timestamp: doc.createdAt,
        });
        deliveredIds.push(doc._id);
      }

      const entity = await resolveEntity(userId);
      if (entity?.fcmToken) {
        await sendPush(entity.fcmToken, title, description, { type, ...pushData });
      }
      if (!online && entity?.email) {
        await sendMail(entity.email, title, description, "notification", entity._resolvedType || "employee");
      }
    })
  );

  if (deliveredIds.length > 0) {
    await Notification.updateMany({ _id: { $in: deliveredIds } }, { $set: { isRead: true } });
  }

  return notificationDocs;
};

module.exports = { notifyUsers };
