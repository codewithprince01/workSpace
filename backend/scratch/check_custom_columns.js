const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const CustomColumn = mongoose.model('CustomColumn', new mongoose.Schema({ key: String, name: String }));
    
    const count = await CustomColumn.countDocuments();
    console.log('Total Custom Columns:', count);
    
    const sample = await CustomColumn.findOne({ key: 'Wcf0yEFgesooLsqUANpa_' });
    console.log('Sample for key Wcf0yEFgesooLsqUANpa_:', sample);
    
    const all = await CustomColumn.find().limit(5);
    console.log('First 5 columns:', JSON.stringify(all, null, 2));

    process.exit(0);
}

check();
