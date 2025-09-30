# API Documentation - Enhanced Features

## 🔐 Authentication Endpoints

### Enhanced Signup
**POST** `/api/auth/signup`

Register a new user with role selection and worklet validation.

**Request Body:**
```json
{
  "name": "string (required, max 50 chars)",
  "email": "string (required, valid email format)",
  "password": "string (required, min 6 chars)",
  "role": "student | admin (required)",
  "workletId": "string (required for student role)"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Account created successfully! You can now log in.",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "student | admin",
    "workletId": "string (if student)",
    "isActive": true,
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  },
  "token": "JWT token string"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Array of validation errors"]
}
```

**Response (Worklet Validation Error - 400):**
```json
{
  "success": false,
  "message": "Invalid worklet ID. Please check and try again.",
  "workletError": true
}
```

### Worklet Validation
**POST** `/api/auth/validate-worklet`

Validate a worklet ID for student registration.

**Request Body:**
```json
{
  "workletId": "string (required)"
}
```

**Response (Valid Worklet - 200):**
```json
{
  "valid": true,
  "worklet": {
    "id": "string",
    "title": "string",
    "description": "string",
    "category": "string",
    "status": "string",
    "metadata": {
      "additionalInfo": "object"
    }
  }
}
```

**Response (Invalid Worklet - 404):**
```json
{
  "valid": false,
  "message": "Worklet not found"
}
```

### Enhanced Login
**POST** `/api/auth/login`

Authenticate user with enhanced response including role information.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "student | admin | user",
    "workletId": "string (if student)",
    "isActive": true,
    "lastLogin": "ISO string",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  },
  "token": "JWT token string"
}
```

### Get Current User
**GET** `/api/auth/me`

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "student | admin | user",
    "workletId": "string (if student)",
    "isActive": true,
    "lastLogin": "ISO string",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}
```

## 💬 Enhanced Chat Endpoints

### Generate RAG Response (Worklet-Aware)
**POST** `/api/chat/generate`

Generate AI response with worklet-aware context for students.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "message": "string (required)",
  "contextual": "boolean (optional, default: true)"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "response": "string (AI generated response)",
  "sources": [
    {
      "id": "string",
      "title": "string",
      "type": "general | worklet-specific",
      "workletId": "string (if worklet-specific)",
      "relevance": "number (0-1)",
      "excerpt": "string"
    }
  ],
  "metadata": {
    "queryType": "general | worklet-specific",
    "processingTime": "number (ms)",
    "sourcesUsed": "number"
  }
}
```

## 👥 Enhanced Admin Endpoints

### List All Users (Enhanced)
**GET** `/api/admin/users`

Get list of all users with enhanced filtering and role information.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `role` (optional): Filter by role (`student`, `admin`, `user`)
- `workletId` (optional): Filter by worklet ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response (Success - 200):**
```json
{
  "success": true,
  "users": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "student | admin | user",
      "workletId": "string (if student)",
      "isActive": true,
      "lastLogin": "ISO string",
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ],
  "pagination": {
    "currentPage": "number",
    "totalPages": "number",
    "totalUsers": "number",
    "hasNext": "boolean",
    "hasPrev": "boolean"
  },
  "statistics": {
    "totalUsers": "number",
    "studentCount": "number",
    "adminCount": "number",
    "activeUsers": "number"
  }
}
```

### User Statistics
**GET** `/api/admin/users/stats`

Get comprehensive user statistics.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "statistics": {
    "total": "number",
    "byRole": {
      "student": "number",
      "admin": "number",
      "user": "number"
    },
    "byStatus": {
      "active": "number",
      "inactive": "number"
    },
    "registrationTrend": [
      {
        "date": "ISO string",
        "count": "number"
      }
    ],
    "workletDistribution": [
      {
        "workletId": "string",
        "userCount": "number"
      }
    ]
  }
}
```

## 📋 Worklet Management Endpoints

### List Worklets
**GET** `/api/admin/worklets`

Get list of all available worklets.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `status` (optional): Filter by status
- `category` (optional): Filter by category

**Response (Success - 200):**
```json
{
  "success": true,
  "worklets": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "status": "active | inactive",
      "userCount": "number",
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ]
}
```

### Get Worklet Details
**GET** `/api/admin/worklets/:id`

Get detailed information about a specific worklet.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "worklet": {
    "id": "string",
    "title": "string",
    "description": "string",
    "category": "string",
    "status": "active | inactive",
    "metadata": "object",
    "userCount": "number",
    "users": [
      {
        "id": "string",
        "name": "string",
        "email": "string",
        "joinedAt": "ISO string"
      }
    ],
    "documents": [
      {
        "id": "string",
        "title": "string",
        "type": "string",
        "uploadedAt": "ISO string"
      }
    ],
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}
```

## 🔍 Enhanced Search Endpoints

### Search Documents (Worklet-Aware)
**GET** `/api/documents/search`

Search documents with worklet-aware filtering for students.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Document type filter
- `workletOnly` (optional): For students, search only worklet-specific documents

**Response (Success - 200):**
```json
{
  "success": true,
  "documents": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "general | worklet-specific",
      "workletId": "string (if worklet-specific)",
      "relevance": "number (0-1)",
      "preview": "string",
      "createdAt": "ISO string"
    }
  ],
  "metadata": {
    "totalResults": "number",
    "searchTime": "number (ms)",
    "query": "string",
    "filters": "object"
  }
}
```

## 📊 System Health & Monitoring

### System Health Check
**GET** `/api/health`

Enhanced health check with system status.

**Response (Success - 200):**
```json
{
  "status": "OK",
  "message": "Samsung PRISM Backend is running",
  "timestamp": "ISO string",
  "version": "string",
  "uptime": "number (seconds)",
  "services": {
    "database": "connected | disconnected",
    "auth": "operational | degraded",
    "rag": "operational | degraded"
  }
}
```

### System Statistics
**GET** `/api/admin/system/stats`

Get comprehensive system statistics.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "statistics": {
    "users": {
      "total": "number",
      "active": "number",
      "newToday": "number"
    },
    "documents": {
      "total": "number",
      "processed": "number",
      "pending": "number"
    },
    "chat": {
      "totalQueries": "number",
      "queriesToday": "number",
      "averageResponseTime": "number (ms)"
    },
    "worklets": {
      "total": "number",
      "active": "number",
      "averageUsersPerWorklet": "number"
    }
  }
}
```

## 🛠️ Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Error code or type",
  "details": "Additional error details (optional)",
  "timestamp": "ISO string"
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created (successful registration/creation)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (resource doesn't exist)
- **409**: Conflict (duplicate email, etc.)
- **422**: Unprocessable Entity (invalid worklet ID)
- **500**: Internal Server Error

### Rate Limiting
- **429**: Too Many Requests
- **X-RateLimit-Limit**: Requests per time window
- **X-RateLimit-Remaining**: Remaining requests
- **X-RateLimit-Reset**: Time when limit resets

## 🔧 Request/Response Headers

### Required Headers for Protected Endpoints
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Optional Headers
```
X-Client-Version: string (for compatibility checking)
X-Request-ID: string (for request tracing)
```

### Response Headers
```
X-Response-Time: number (ms)
X-Request-ID: string (echoed from request)
X-Rate-Limit-*: Rate limiting information
```

---

*This API documentation covers all enhanced endpoints and features. For implementation examples, refer to the frontend service files and backend controller implementations.*