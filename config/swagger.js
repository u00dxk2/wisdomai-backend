/**
 * @fileoverview Swagger/OpenAPI configuration for WisdomAI API documentation.
 */

import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger configuration options.
 * @type {Object}
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WisdomAI API',
      version: '1.0.0',
      description: 'API documentation for WisdomAI - A conversational AI that emulates historical wisdom figures',
      contact: {
        name: 'API Support',
        email: 'support@wisdomai.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:5001'
          : 'https://wisdomai-backend.onrender.com',
        description: process.env.NODE_ENV === 'development' ? 'Development server' : 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    security: [
      {
        bearerAuth: [],
        apiKeyAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './models/*.js']
};

const specs = swaggerJsdoc(options);

export default specs; 