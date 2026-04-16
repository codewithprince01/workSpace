require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const CalendarEvent = require('../models/CalendarEvent');
const logger = require('../utils/logger');

/**
 * Migration Script: Migrate assigned_user_id to assigned_user_ids
 * 
 * This script migrates existing calendar events from the single assigned_user_id
 * field to the new assigned_user_ids array field. It also sets is_all_members to false
 * for all existing events.
 * 
 * Run: node src-new/scripts/migrate-calendar-events.js
 */

const migrateCalendarEvents = async () => {
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || process.env.DB_URL;
    if (!MONGO_URI) {
      throw new Error('MONGO_URI not set in environment variables');
    }

    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB');

    // Find all events that have assigned_user_id but no assigned_user_ids
    const eventsToMigrate = await CalendarEvent.find({
      assigned_user_id: { $exists: true, $ne: null },
      assigned_user_ids: { $exists: false }
    });

    logger.info(`Found ${eventsToMigrate.length} events to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const event of eventsToMigrate) {
      try {
        // Migrate: move assigned_user_id to assigned_user_ids array
        await CalendarEvent.findByIdAndUpdate(event._id, {
          assigned_user_ids: [event.assigned_user_id],
          is_all_members: false
        });

        migratedCount++;
        logger.info(`Migrated event ${event._id}: assigned_user_id -> assigned_user_ids`);
      } catch (error) {
        errorCount++;
        logger.error(`Failed to migrate event ${event._id}:`, error);
      }
    }

    // Update events that have assigned_user_ids array but is_all_members is not set
    const eventsWithoutIsAllMembers = await CalendarEvent.find({
      assigned_user_ids: { $exists: true },
      is_all_members: { $exists: false }
    });

    logger.info(`Found ${eventsWithoutIsAllMembers.length} events to update is_all_members flag`);

    for (const event of eventsWithoutIsAllMembers) {
      try {
        await CalendarEvent.findByIdAndUpdate(event._id, {
          is_all_members: false
        });

        migratedCount++;
        logger.info(`Updated event ${event._id}: set is_all_members = false`);
      } catch (error) {
        errorCount++;
        logger.error(`Failed to update event ${event._id}:`, error);
      }
    }

    logger.info(`Migration complete. Migrated: ${migratedCount}, Errors: ${errorCount}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateCalendarEvents();
