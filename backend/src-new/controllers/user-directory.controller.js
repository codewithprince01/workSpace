const { User } = require('../models');
const XLSX = require('xlsx');
const mongoose = require('mongoose');


const DEFAULT_PASSWORD = 'Britannica@1234';
const DEFAULT_DEPARTMENT = '';

// ── helpers ────────────────────────────────────────────────────────────────
const formatUser = (u) => ({
  id:          u._id.toString(),
  name:        u.name,
  email:       u.email,
  department:  u.department || '',
  is_active:   u.is_active,
  created_at:  u.created_at,
  provisioned: !!u.provisioned_by,
  avatar_url:  u.avatar_url || null,
});

const createOrSkip = async (name, email, department, createdById) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Skip duplicates
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return { user: existing, created: false };
  }

  // Store plain-text — the User model pre('save') hook hashes it automatically.
  // setup_completed stays false; the login handler auto-creates the team and
  // flips it to true on first login, bypassing the /setup screen entirely.
  const user = await User.create({
    name:            name.trim(),
    email:           normalizedEmail,
    password:        DEFAULT_PASSWORD,
    department:      department || DEFAULT_DEPARTMENT,
    is_active:       true,
    role:            'user',
    setup_completed: false,   // login will auto-complete setup
    provisioned_by:  createdById,
  });

  return { user, created: true };
};



// ── GET /api/super-admin/user-directory ────────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(500, parseInt(req.query.limit) || 20);
    const search = req.query.search || '';
    const skip   = (page - 1) * limit;

    const query = {};
    if (search) {
      const re = { $regex: search, $options: 'i' };
      query.$or = [{ name: re }, { email: re }, { department: re }];
    }

    const [users, total] = await Promise.all([
      User.find(query).select('-password -password_reset_token -password_reset_expires').sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    res.json({ done: true, body: users.map(formatUser), total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ── POST /api/super-admin/user-directory/single ───────────────────────────
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, department } = req.body;
    if (!name || !email) return res.status(400).json({ done: false, message: 'Name and email are required' });

    const { user, created } = await createOrSkip(name, email, department, req.user._id);
    if (!created) return res.json({ done: true, body: formatUser(user), message: 'User already exists — skipped duplicate' });

    res.status(201).json({ done: true, body: formatUser(user), message: 'User created successfully' });
  } catch (err) { next(err); }
};

// ── POST /api/super-admin/user-directory/bulk ─────────────────────────────
exports.bulkUpload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ done: false, message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) return res.status(400).json({ done: false, message: 'File is empty or has no data rows' });

    const results = { created: [], skipped: [], errors: [] };

    for (const row of rows) {
      let name = String(row['Name'] || row['name'] || row['Full Name'] || '').trim();
      
      // If Name is missing, try to combine First Name and Last Name
      if (!name) {
        const firstName = String(row['First Name'] || '').trim();
        const lastName  = String(row['Last Name'] || '').trim();
        name = `${firstName} ${lastName}`.trim();
      }
      const email      = String(row['Email'] || row['email'] || '').trim();
      const department = String(row['Department'] || row['department'] || row['Dept'] || row['dept'] || '').trim();

      if (!name || !email) { results.errors.push({ row, reason: 'Missing name or email' }); continue; }
      if (!/\S+@\S+\.\S+/.test(email)) { results.errors.push({ row, reason: 'Invalid email format' }); continue; }

      try {
        const { user, created } = await createOrSkip(name, email, department, req.user._id);
        if (created) results.created.push(formatUser(user));
        else         results.skipped.push(email);
      } catch (e) {
        results.errors.push({ row, reason: e.message });
      }
    }

    res.json({
      done: true,
      body: results,
      message: `Done — ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`,
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/super-admin/user-directory/:userId ────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ done: false, message: 'Invalid user ID' });

    // Prevent deleting super admin
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ done: false, message: 'User not found' });
    if (user.role === 'super_admin') return res.status(403).json({ done: false, message: 'Cannot delete a super admin' });

    await User.findByIdAndDelete(userId);
    res.json({ done: true, message: 'User deleted successfully' });
  } catch (err) { next(err); }
};

// ── GET /api/super-admin/user-directory/search?q=… ───────────────────────
// Used by invite auto-suggest dropdowns
exports.searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ done: true, body: [] });

    const re    = { $regex: q, $options: 'i' };
    const users = await User.find({ $or: [{ email: re }, { name: re }] })
      .select('name email department avatar_url')
      .limit(20)
      .lean();

    res.json({ done: true, body: users.map(u => ({ id: u._id, name: u.name, email: u.email, department: u.department || '', avatar_url: u.avatar_url || null })) });
  } catch (err) { next(err); }
};
