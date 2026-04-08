# Worklenz PostgreSQL से MongoDB Migration Guide

यह guide आपको Worklenz application को PostgreSQL से MongoDB में migrate करने के लिए step-by-step instructions प्रदान करता है।

## 📋 Migration Overview

### क्या Migrate हो रहा है?
- **Users** - User accounts और profiles
- **Teams** - Team information और settings
- **Projects** - Project details और configurations
- **Tasks** - Task data, assignments, और relationships
- **Project Members** - Project membership और access levels
- **Task Statuses** - Custom task statuses
- **Task Labels** - Task labels और tags
- **Task Phases** - Task phases और stages
- **Time Entries** - Time tracking data

### Architecture Changes
- **Dual Database Support**: Application अब दोनों PostgreSQL और MongoDB को support करता है
- **Database Service Layer**: एक unified service layer जो database queries को handle करता है
- **Environment-based Selection**: `.env` file से database type select कर सकते हैं

## 🚀 Migration Steps

### Step 1: Prerequisites

1. **MongoDB Installation**:
   ```bash
   # Local MongoDB
   brew install mongodb-community  # macOS
   sudo apt-get install mongodb    # Ubuntu
   
   # या MongoDB Atlas (Cloud)
   # https://www.mongodb.com/cloud/atlas
   ```

2. **Environment Setup**:
   ```bash
   # Copy environment file
   cp .env.example .env
   
   # Update .env file
   DB_TYPE=mongodb
   MONGO_URI=mongodb://localhost:27017/worklenz_db
   ```

### Step 2: Install Dependencies

```bash
cd worklenz-backend
npm install
```

### Step 3: Database Migration

#### Option A: Development Mode (Direct TypeScript)
```bash
npm run migrate:to-mongodb:dev
```

#### Option B: Production Mode (Compiled JavaScript)
```bash
npm run build
npm run migrate:to-mongodb
```

### Step 4: Test Migration

```bash
# Test MongoDB integration
npm run test:mongodb:dev

# या production test
npm run test:mongodb
```

### Step 5: Switch to MongoDB

Update your `.env` file:
```env
DB_TYPE=mongodb
MONGO_URI=mongodb://localhost:27017/worklenz_db
```

Restart your application:
```bash
npm start
```

## 🔧 Configuration Options

### Environment Variables

```env
# Database Type Selection
DB_TYPE=mongodb                    # 'postgresql' या 'mongodb'

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/worklenz_db

# PostgreSQL Configuration (backup)
DB_NAME=worklenz_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

### MongoDB Atlas Configuration

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/worklenz_db?retryWrites=true&w=majority
```

## 📊 Migration Scripts

### migrate-to-mongodb.ts
- **Purpose**: PostgreSQL से MongoDB में complete data migration
- **Features**:
  - Maintains referential integrity
  - Preserves timestamps और metadata
  - Handles large datasets efficiently
  - Progress tracking

### test-mongodb-integration.ts
- **Purpose**: MongoDB integration testing
- **Tests**:
  - Database connections
  - CRUD operations
  - Relationships
  - Transactions
  - Data integrity

## 🔍 Database Service Layer

### DatabaseService Class
यह unified interface दोनों databases के लिए provide करता है:

```typescript
// User operations
await DatabaseService.createUser(userData);
await DatabaseService.findUserByEmail(email);
await DatabaseService.findUserById(id);
await DatabaseService.updateUser(id, updateData);

// Project operations
await DatabaseService.createProject(projectData);
await DatabaseService.findProjectById(id);
await DatabaseService.findProjectsByTeam(teamId);

// Task operations
await DatabaseService.createTask(taskData);
await DatabaseService.findTaskById(id);
await DatabaseService.findTasksByProject(projectId);
```

### DBQueryHelper Utility
Existing PostgreSQL queries को MongoDB compatible बनाने के लिए:

```typescript
// Replace direct queries
const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

// With helper
const user = await DBQueryHelper.getUserByEmail(email);
```

## 🚨 Important Notes

### Data Integrity
- **Original IDs Preserved**: PostgreSQL IDs MongoDB में `_id` के रूप में store होते हैं
- **Timestamps Maintained**: `created_at` और `updated_at` timestamps preserved होते हैं
- **Relationships Mapped**: Foreign key relationships properly mapped होते हैं

### Performance Considerations
- **Indexing**: MongoDB schemas में proper indexes defined हैं
- **Population**: Related data populate करने के लिए methods available हैं
- **Batch Processing**: Large datasets के लिए efficient processing

### Rollback Plan
अगर आपको PostgreSQL पर वापस जाना है:

```env
DB_TYPE=postgresql
```

Application automatically PostgreSQL का use करने लगेगा।

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Issues
```bash
# Check MongoDB connection
mongosh mongodb://localhost:27017/worklenz_db

# Check PostgreSQL connection
psql -h localhost -U postgres -d worklenz_db
```

#### 2. Migration Failures
```bash
# Check logs
npm run migrate:to-mongodb:dev 2>&1 | tee migration.log

# Common fixes:
# - Check database permissions
# - Verify data integrity
# - Ensure enough disk space
```

#### 3. Performance Issues
```bash
# MongoDB optimization
mongosh --eval "db.users.createIndex({email: 1})"
mongosh --eval "db.projects.createIndex({team_id: 1})"
```

## 📈 Post-Migration Benefits

### MongoDB Advantages
- **Flexible Schema**: Easy to add new fields
- **Scalability**: Horizontal scaling support
- **Performance**: Faster read operations for complex queries
- **JSON Support**: Native JSON document storage
- **Aggregation**: Powerful data aggregation pipelines

### Application Benefits
- **Dual Support**: Easy switching between databases
- **Modern Stack**: MongoDB with Mongoose ODM
- **Better Performance**: Optimized queries and indexing
- **Future-proof**: Easy to scale and maintain

## 🔄 Maintenance

### Regular Tasks
1. **Database Backups**: Regular MongoDB backups
2. **Index Optimization**: Monitor and optimize indexes
3. **Performance Monitoring**: Track query performance
4. **Data Validation**: Periodic data integrity checks

### Monitoring
```bash
# MongoDB status
mongosh --eval "db.stats()"

# Collection sizes
mongosh --eval "db.users.stats()"
mongosh --eval "db.projects.stats()"
```

## 📞 Support

अगर आपको migration के दौरान कोई problem आती है:

1. **Check Logs**: Application logs check करें
2. **Run Tests**: Integration tests run करें
3. **Verify Data**: Data integrity validate करें
4. **Rollback**: जरूरत हो तो PostgreSQL पर वापस जाएं

---

## 🎉 Migration Complete!

एक बार migration successful हो जाए, तो आपका application MongoDB के साथ fully functional होगा। आप अब MongoDB के benefits enjoy कर सकते हैं!
