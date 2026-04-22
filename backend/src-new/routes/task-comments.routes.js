const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { TaskComment, Task, ActivityLog, User, TeamMember, TaskAttachment } = require('../models');
const emailService = require('../services/email.service');
const storageService = require('../services/storage.service');
const notificationService = require('../services/notification.service');
const mongoose = require('mongoose');

// Apply protection
router.use(protect);

const formatFileSize = bytes => {
    const size = Number(bytes || 0);
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const mapAttachmentToViewModel = attachment => ({
    id: attachment._id?.toString?.() || attachment.id,
    name: attachment.file_name,
    url: attachment.url,
    size: formatFileSize(attachment.file_size),
    type: attachment.file_type,
    created_at: attachment.created_at,
});

// GET /api/task-comments/:taskId - Get comments for a task
router.get('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const comments = await TaskComment.find({ task_id: taskId })
            .populate('user_id', 'name avatar_url email')
            .sort({ created_at: -1 });

        const commentIds = comments.map(c => c._id).filter(Boolean);
        const attachments = commentIds.length
            ? await TaskAttachment.find({ comment_id: { $in: commentIds } }).sort({ created_at: 1 })
            : [];
        const attachmentsByComment = attachments.reduce((acc, attachment) => {
            const key = attachment.comment_id?.toString?.();
            if (!key) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(mapAttachmentToViewModel(attachment));
            return acc;
        }, {});

        const formattedComments = comments.map(comment => ({
            id: comment._id,
            task_id: comment.task_id,
            content: comment.content,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            user_id: comment.user_id?._id,
            member_name: comment.user_id?.name,
            avatar_url: comment.user_id?.avatar_url,
            email: comment.user_id?.email,
            attachments: attachmentsByComment[comment._id.toString()] || [],
            reactions: [] // Reactions logic if any
        }));

        res.json({ done: true, body: formattedComments });
    } catch (error) {
        console.error('Fetch task comments error:', error);
        res.status(500).json({ done: false, message: 'Failed to fetch task comments' });
    }
});

// POST /api/task-comments - Create a comment
router.post('/', async (req, res) => {
    try {
        const { task_id, content, notify_users, attachments } = req.body;
        const normalizedContent = String(content || '').trim();
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
        const contentToSave = normalizedContent || (hasAttachments ? '\u200B' : '');

        if (!task_id || (!normalizedContent && !hasAttachments)) {
            return res
                .status(400)
                .json({ done: false, message: 'Task ID and content are required' });
        }

        const newComment = await TaskComment.create({
            task_id,
            content: contentToSave,
            user_id: req.user._id
        });

        // Create Activity Log
        const task = await Task.findById(task_id).populate('project_id', 'name team_id');
        if (!task) {
            return res.status(404).json({ done: false, message: 'Task not found' });
        }

        const savedAttachments = [];
        if (hasAttachments) {
            for (const attachment of attachments) {
                const fileName = String(attachment?.file_name || '').trim();
                const fileData = String(attachment?.file || '').trim();
                if (!fileName || !fileData) continue;

                const key = `task-comments/${task_id}/${newComment._id}/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
                const fileUrl = await storageService.uploadBase64(
                    key,
                    fileData,
                    fileName,
                    req.user._id
                );
                const extension = (fileName.split('.').pop() || '').toLowerCase();

                const createdAttachment = await TaskAttachment.create({
                    task_id,
                    comment_id: newComment._id,
                    project_id: task.project_id?._id || task.project_id,
                    user_id: req.user._id,
                    file_name: fileName,
                    file_key: key,
                    file_size: Number(attachment?.size || 0),
                    file_type: extension || 'file',
                    url: fileUrl
                });

                savedAttachments.push(createdAttachment);
            }
        }

        const populatedComment = await TaskComment.findById(newComment._id)
            .populate('user_id', 'name avatar_url email');

        if (task) {
            await ActivityLog.create({
                task_id,
                project_id: task.project_id,
                done_by: req.user._id,
                log_type: 'comment',
                log_text: `added a comment`,
                attribute_type: 'COMMENT'
            });

            try {
                // --- SEND EMAIL NOTIFICATIONS ---
                // Users to notify:
                // 1) Explicit notify list from frontend (user_id / team_member_id / email)
                // 2) Task subscribers from DB
                const candidateValues = new Set([
                    ...((Array.isArray(notify_users) ? notify_users : []).map(v => String(v || '').trim()).filter(Boolean)),
                    ...((task.subscribers || []).map(v => String(v || '').trim()).filter(Boolean)),
                ]);

                const candidateObjectIds = [];
                const candidateEmails = [];
                for (const value of candidateValues) {
                    if (value.includes('@')) {
                        candidateEmails.push(value.toLowerCase());
                    } else if (mongoose.Types.ObjectId.isValid(value)) {
                        candidateObjectIds.push(value);
                    }
                }

                const [matchedUsersById, matchedUsersByEmail, teamMembers] = await Promise.all([
                    candidateObjectIds.length
                        ? User.find({ _id: { $in: candidateObjectIds } }).select('_id')
                        : [],
                    candidateEmails.length
                        ? User.find({ email: { $in: candidateEmails } }).select('_id')
                        : [],
                    candidateObjectIds.length
                        ? TeamMember.find({ _id: { $in: candidateObjectIds } }).select('user_id')
                        : [],
                ]);

                const resolvedUserIds = new Set([
                    ...matchedUsersById.map(u => u._id.toString()),
                    ...matchedUsersByEmail.map(u => u._id.toString()),
                    ...teamMembers.map(tm => tm?.user_id?.toString()).filter(Boolean),
                ]);

                // Filter out the sender themselves
                resolvedUserIds.delete(req.user._id.toString());
                const filteredUserIds = Array.from(resolvedUserIds);

                if (filteredUserIds.length > 0) {
                    const recipients = await User.find({
                        _id: { $in: filteredUserIds },
                        email_notifications_enabled: { $ne: false },
                    });

                    const senderName = req.user.name || 'A team member';
                    const notificationMessage = `**${senderName}** added a comment on **${task.name}**`;
                    const projectIdForNotification = task.project_id?._id || task.project_id || null;
                    const teamIdForNotification = task.project_id?.team_id || null;

                    for (const recipientId of filteredUserIds) {
                        if (String(recipientId) === String(req.user._id)) continue;
                        await notificationService.createNotification({
                            user_id: recipientId,
                            type: 'comment_added',
                            message: notificationMessage,
                            project_id: projectIdForNotification,
                            task_id: task._id,
                            team_id: teamIdForNotification,
                            meta: {
                                sender_name: senderName,
                                project_name: task.project_id?.name || '',
                            },
                        });
                    }
                    
                    for (const recipient of recipients) {
                        if (recipient.email) {
                            const subject = `${senderName} added a comment on ${task.name} (${senderName})`;
                            const appBaseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
                            const logoUrl = `${appBaseUrl}/worklenz-logo.png`;
                            const projectId = task?.project_id?._id?.toString?.() || task?.project_id?.toString?.() || '';
                            const taskId = task?._id?.toString?.() || '';
                            const taskUrl = `${appBaseUrl}/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${taskId}`;
                            const safeComment = String(
                                normalizedContent || (hasAttachments ? 'Attachment added' : '')
                            )
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                            const attachmentLinksHtml = savedAttachments.length
                                ? `
                                <div style="margin-top:10px;">
                                  <div style="font-size:13px; font-weight:700; margin-bottom:6px;">Attachments</div>
                                  ${savedAttachments
                                      .map(a => `<div style="margin:2px 0;"><a href="${a.url}" style="color:#1e88ff; text-decoration:underline;" target="_blank" rel="noopener noreferrer">${String(a.file_name || 'Attachment').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a></div>`)
                                      .join('')}
                                </div>`
                                : '';
                            
                            const html = `
                            <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#111827; padding:24px 18px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px; margin:0 auto;">
                                <tr>
                                  <td style="padding-bottom:8px;">
                                    <img src="${logoUrl}" alt="Worklenz" width="30" height="30" style="display:block; width:30px; height:30px; object-fit:contain;" />
                                  </td>
                                </tr>
                                <tr>
                                  <td style="font-size:16px; line-height:1.3; font-weight:700; padding-bottom:10px;">
                                    Hi ${recipient.name || 'there'},
                                  </td>
                                </tr>
                                <tr>
                                  <td style="font-size:14px; color:#111827; padding-bottom:8px;">
                                    ${senderName} added a comment on ${task.name} (${senderName})
                                  </td>
                                </tr>
                                <tr>
                                  <td style="border-bottom:1px solid #e5e7eb; padding-bottom:10px;"></td>
                                </tr>
                                <tr>
                                  <td style="padding-top:12px; font-size:14px; line-height:1.45; color:#111827;">
                                    <div style="font-size:15px; font-weight:700; margin-bottom:6px;">${senderName}</div>
                                    <div style="color:#1f2937; margin-bottom:6px;">${safeComment}</div>
                                    ${attachmentLinksHtml}
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-top:16px; padding-bottom:14px;">
                                    <a href="${taskUrl}" style="background:#1e88ff; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; border-radius:8px; padding:10px 18px; display:inline-block;">
                                      Reply to this
                                    </a>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="border-top:1px solid #e5e7eb; padding-top:12px; font-size:12px; color:#6b7280;">
                                    This email sending to you because you have enabled email notifications.
                                    <a href="${appBaseUrl}/worklenz/settings/notifications" style="color:#4b5563; text-decoration:underline; margin-left:4px;">
                                      Stop sending it to me.
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </div>
                        `;

                            // Send async but don't wait for each to finish to avoid blocking response
                            emailService.sendEmail({
                                to: recipient.email,
                                subject,
                                html
                            }).catch(err => console.error(`Failed to send comment notification to ${recipient.email}:`, err));
                        }
                    }
                }
            } catch (notificationError) {
                console.error('Comment notification error:', notificationError);
            }
        }

        const response = {
            id: populatedComment._id,
            task_id: populatedComment.task_id,
            content: populatedComment.content,
            created_at: populatedComment.created_at,
            updated_at: populatedComment.updated_at,
            user_id: populatedComment.user_id?._id,
            member_name: populatedComment.user_id?.name,
            avatar_url: populatedComment.user_id?.avatar_url,
            email: populatedComment.user_id?.email,
            attachments: savedAttachments.map(mapAttachmentToViewModel),
            reactions: []
        };

        res.json({ done: true, body: response });
    } catch (error) {
        console.error('Create comment error:', error);
        if (error?.name === 'ValidationError') {
            return res.status(400).json({ done: false, message: 'Task ID and content are required' });
        }
        res.status(500).json({ done: false, message: 'Failed to create comment' });
    }
});

// DELETE /api/task-comments/attachment/:id/:taskId - Delete comment attachment
router.delete('/attachment/:id/:taskId', async (req, res) => {
    try {
        const { id, taskId } = req.params;
        const attachment = await TaskAttachment.findOne({ _id: id, task_id: taskId });
        if (!attachment) {
            return res.status(404).json({ done: false, message: 'Attachment not found' });
        }

        if (String(attachment.user_id) !== String(req.user._id)) {
            return res.status(403).json({ done: false, message: 'Not authorized' });
        }

        if (attachment.file_key) {
            await storageService.deleteFile(attachment.file_key);
        }

        await TaskAttachment.deleteOne({ _id: attachment._id });
        return res.json({ done: true, body: { id } });
    } catch (error) {
        console.error('Delete comment attachment error:', error);
        return res.status(500).json({ done: false, message: 'Failed to delete attachment' });
    }
});

// DELETE /api/task-comments/:id/:taskId - Delete a comment
router.delete('/:id/:taskId', async (req, res) => {
    try {
        const { id, taskId } = req.params;

        const comment = await TaskComment.findOne({ _id: id, task_id: taskId });
        
        if (!comment) {
            return res.status(404).json({ done: false, message: 'Comment not found' });
        }

        // Check permission: only owner or admin can delete
        if (comment.user_id.toString() !== req.user._id.toString()) {
             return res.status(403).json({ done: false, message: 'Not authorized to delete this comment' });
        }

        const commentAttachments = await TaskAttachment.find({ comment_id: id });
        for (const attachment of commentAttachments) {
            if (attachment.file_key) {
                await storageService.deleteFile(attachment.file_key);
            }
        }
        await TaskAttachment.deleteMany({ comment_id: id });
        await TaskComment.deleteOne({ _id: id });

        res.json({ done: true, body: { id } });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ done: false, message: 'Failed to delete comment' });
    }
});

// PUT /api/task-comments/:id - Update a comment
router.put('/:id', async (req, res) => {
    try {
        const { content } = req.body;
        const comment = await TaskComment.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { content },
            { new: true }
        ).populate('user_id', 'name avatar_url email');

        if (!comment) {
            return res.status(404).json({ done: false, message: 'Comment not found or unauthorized' });
        }

        res.json({ done: true, body: comment });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to update comment' });
    }
});

// PUT /api/task-comments/reaction/:id - Update reaction
router.put('/reaction/:id', async (req, res) => {
    try {
        const reactionType = req.query.reaction_type || req.body.reaction_type;
        // Basic reaction logic
        res.json({ done: true });
    } catch (error) {
        res.status(500).json({ done: false, message: 'Failed to update reaction' });
    }
});

module.exports = router;
