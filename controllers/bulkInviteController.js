const Channel = require("../models/Channels");
const ChannelInvite = require("../models/ChannelInvite");
const Admin = require("../models/Admin");
const sendMail = require("../services/sendMail");
const { getIo } = require("../utils/socket");

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Send bulk invites to multiple emails
const sendBulkInvites = async (req, res) => {
  try {
    const { channelId, emails } = req.body;
    const invitedBy = req.user.userId;

    // Validate inputs
    if (!channelId || !emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Channel ID and non-empty email array are required",
      });
    }

    // Check channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Validate and send invites
    const results = {
      successful: [],
      failed: [],
    };

    for (const email of emails) {
      const trimmedEmail = email.trim();

      // Validate email format
      if (!isValidEmail(trimmedEmail)) {
        results.failed.push({
          email: trimmedEmail,
          reason: "Invalid email format",
        });
        continue;
      }

      try {
        // Create invite record
        const inviteLink = `${process.env.FRONTEND_URL}/invite/${Math.random().toString(36).substring(2, 15)}`;
        
        const invite = new ChannelInvite({
          channelId,
          email: trimmedEmail,
          inviteLink,
          invitedBy,
        });

        await invite.save();

        // Send email
        const mailSubject = `You're invited to join ${channel.name}`;
        const mailBody = `
          You have been invited to join the channel: ${channel.name}
          
          Click the link below to join:
          ${inviteLink}
          
          This invite will expire in 30 days.
        `;

        const mailSent = await sendMail(trimmedEmail, mailSubject, mailBody);

        if (mailSent) {
          results.successful.push({
            email: trimmedEmail,
            status: "Invite sent",
          });
        } else {
          results.failed.push({
            email: trimmedEmail,
            reason: "Failed to send email",
          });
        }
      } catch (error) {
        results.failed.push({
          email: trimmedEmail,
          reason: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk invites processed",
      data: results,
      summary: {
        total: emails.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
    });
  } catch (error) {
    console.error("Error sending bulk invites:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get pending invites for a channel
const getPendingInvites = async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    const invites = await ChannelInvite.find({
      channelId,
      status: "pending",
    })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: invites,
    });
  } catch (error) {
    console.error("Error fetching pending invites:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Accept invite
const acceptInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { email } = req.body;

    const invite = await ChannelInvite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }

    if (invite.email !== email) {
      return res.status(403).json({ 
        success: false, 
        message: "Email does not match invite" 
      });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({ 
        success: false, 
        message: "This invite has already been used" 
      });
    }

    // Update invite status
    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();

    res.status(200).json({
      success: true,
      message: "Invite accepted successfully",
      channelId: invite.channelId,
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Resend invite
const resendInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;

    const invite = await ChannelInvite.findById(inviteId)
      .populate("channelId", "name");

    if (!invite) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }

    const channel = invite.channelId;

    // Resend email
    const mailSubject = `You're invited to join ${channel.name}`;
    const mailBody = `
      You have been invited to join the channel: ${channel.name}
      
      Click the link below to join:
      ${invite.inviteLink}
      
      This invite will expire in 30 days.
    `;

    const mailSent = await sendMail(invite.email, mailSubject, mailBody);

    if (!mailSent) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send email" 
      });
    }

    // Update resent timestamp
    invite.resentAt = new Date();
    await invite.save();

    res.status(200).json({
      success: true,
      message: "Invite resent successfully",
    });
  } catch (error) {
    console.error("Error resending invite:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Cancel invite
const cancelInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;

    const invite = await ChannelInvite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: "Invite not found" });
    }

    await ChannelInvite.findByIdAndDelete(inviteId);

    res.status(200).json({
      success: true,
      message: "Invite cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling invite:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  sendBulkInvites,
  getPendingInvites,
  acceptInvite,
  resendInvite,
  cancelInvite,
};
