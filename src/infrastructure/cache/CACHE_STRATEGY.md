# Cache Strategy Documentation

## Overview

This document describes the caching strategy for the Nexus Internal Portal, implementing Requirements 6.4:
> WHEN data is frequently accessed but rarely changed THEN the Nexus_System SHALL implement caching with invalidation strategies

## Cache-Aside Pattern

The system uses the **Cache-Aside** (Lazy Loading) pattern:

1. **Read Path**:
   - Application checks cache first
   - On cache hit: return cached data
   - On cache miss: fetch from database, store in cache, return data

2. **Write Path**:
   - Write to database
   - Invalidate related cache entries
   - Next read will populate cache with fresh data

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application │────▶│    Cache    │────▶│  Database   │
│             │◀────│             │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │  1. Check cache   │                    │
      │──────────────────▶│                    │
      │  2. Cache miss    │                    │
      │◀──────────────────│                    │
      │  3. Query DB      │                    │
      │────────────────────────────────────────▶
      │  4. Return data   │                    │
      │◀───────────────────────────────────────│
      │  5. Store in cache│                    │
      │──────────────────▶│                    │
      │  6. Return to caller                   │
      │◀──────────────────│                    │
```

## Cacheable Data

### 1. Departments (High Priority)

**Why Cache**: 
- Frequently accessed for dropdowns, user profiles, task assignments
- Rarely changed (organizational structure is stable)

**Cache Key Pattern**: `departments:*`
- `departments:all` - All departments list
- `departments:{id}` - Individual department by ID

**TTL**: 10 minutes

**Invalidation Triggers**:
- Department created
- Department updated
- Department deleted
- Manager assignment changed

### 2. Settings (High Priority)

**Why Cache**:
- Accessed on every task-related page
- Priorities are static, tags/statuses change infrequently

**Cache Key Pattern**: `settings:*`
- `settings:priorities` - Task priorities (static)
- `settings:tags` - Task tags
- `settings:statuses` - Workflow statuses
- `settings:task` - Combined task settings

**TTL**: 
- Priorities: 30 minutes (static data)
- Tags: 2 minutes (changes when tasks are tagged)
- Statuses: 15 minutes

**Invalidation Triggers**:
- Tag added to task (invalidate tags)
- Workflow status added/modified (invalidate statuses)

### 3. User Profiles (Medium Priority)

**Why Cache**:
- Displayed in many places (comments, task assignments, chat)
- Profile changes are infrequent

**Cache Key Pattern**: `users:*`
- `users:{id}` - User profile by ID
- `users:email:{email}` - User by email (for auth)
- `users:all` - All users list

**TTL**: 5 minutes

**Invalidation Triggers**:
- User profile updated
- User status changed
- User deleted

### 4. Dashboard Data (Low Priority)

**Why Cache**:
- Expensive aggregation queries
- Acceptable to show slightly stale data

**Cache Key Pattern**: `dashboard:*`
- `dashboard:overview` - Main dashboard stats
- `dashboard:stats` - Detailed statistics
- `dashboard:personal:{userId}` - Personal dashboard

**TTL**: 
- Overview: 1 minute
- Personal: 30 seconds

**Invalidation Triggers**:
- Generally rely on TTL expiration
- Manual invalidation on significant events (project completion, etc.)

## Invalidation Strategies

### 1. Time-Based Expiration (TTL)

All cache entries have a TTL. This is the primary invalidation mechanism for:
- Dashboard data (short TTL)
- Data that can tolerate slight staleness

### 2. Write-Through Invalidation

When data is modified, explicitly invalidate related cache entries:

```typescript
// Example: Department update
async updateDepartment(id: string, data: Partial<Department>) {
  await this.repository.update(id, data);
  
  // Invalidate specific entry and list
  this.cache.delete(CacheKeys.departments.byId(id));
  this.cache.delete(CacheKeys.departments.all());
}
```

### 3. Pattern-Based Invalidation

For bulk invalidation, use pattern matching:

```typescript
// Invalidate all department-related cache
this.cache.deleteByPattern(CacheKeys.departments.pattern());
```

### 4. Event-Driven Invalidation

For cross-service cache invalidation, use events:

```typescript
// When user profile changes, invalidate user cache
eventEmitter.on('user:updated', (userId) => {
  cache.delete(CacheKeys.users.byId(userId));
});
```

## Cache Configuration

### Environment Variables

```env
# Cache Configuration
CACHE_DEFAULT_TTL_MS=300000      # 5 minutes default
CACHE_MAX_ENTRIES=1000           # Maximum cache entries
CACHE_CLEANUP_INTERVAL_MS=60000  # Cleanup every minute
```

### Recommended Settings by Environment

| Environment | Default TTL | Max Entries | Notes |
|-------------|-------------|-------------|-------|
| Development | 1 minute    | 100         | Shorter TTL for testing |
| Staging     | 5 minutes   | 500         | Match production behavior |
| Production  | 5 minutes   | 1000        | Optimize for performance |

## Monitoring

### Cache Statistics

The cache service exposes statistics:

```typescript
const stats = cache.getStats();
// {
//   hits: 1234,
//   misses: 56,
//   size: 89,
//   evictions: 12,
//   hitRate: 0.956
// }
```

### Key Metrics to Monitor

1. **Hit Rate**: Target > 80% for frequently accessed data
2. **Cache Size**: Monitor for memory pressure
3. **Evictions**: High evictions may indicate need for larger cache
4. **Miss Rate**: High misses on expected cached data may indicate invalidation issues

## Best Practices

### DO:
- ✅ Cache read-heavy, write-light data
- ✅ Use consistent key naming conventions
- ✅ Set appropriate TTLs based on data volatility
- ✅ Invalidate on writes
- ✅ Monitor cache hit rates

### DON'T:
- ❌ Cache user-specific sensitive data without proper isolation
- ❌ Cache data that changes frequently
- ❌ Use very long TTLs without invalidation strategy
- ❌ Cache large objects that consume significant memory
- ❌ Rely solely on TTL for data that must be immediately consistent

## Future Enhancements

When scaling beyond single instance:

1. **Redis Integration**: Replace in-memory cache with Redis for distributed caching
2. **Cache Warming**: Pre-populate cache on startup for critical data
3. **Multi-Level Caching**: L1 (in-memory) + L2 (Redis) for optimal performance
4. **Cache Compression**: Compress large cached objects to reduce memory usage
