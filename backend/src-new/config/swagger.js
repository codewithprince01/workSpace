const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Worklenz API',
      version: '1.4.16',
      description: 'API Documentation for Worklenz Backend (Production Hardened)',
      contact: {
        name: 'Worklenz Dev Team',
        url: 'https://worklenz.com'
      }
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
        description: 'Primary API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'worklenz-session'
        }
      }
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] }
    ]
  },
  // Path to the API docs (controllers and routes)
  apis: [
      './src-new/routes/*.js',
      './src-new/controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
