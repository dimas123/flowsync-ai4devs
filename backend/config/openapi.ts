import { defineConfig } from '@foadonis/openapi'

export default defineConfig({
  ui: 'scalar',
  document: {
    info: {
      title: 'FlowSync API',
      version: '0.1.0',
    },
    /**
     * Relativo y no `http://localhost:3333`: el documento se sirve desde el
     * mismo origen que la API, así que una URL relativa es cierta en local y
     * en cualquier despliegue, mientras que una absoluta solo lo sería en uno.
     */
    servers: [{ url: '/', description: 'El mismo origen que sirve este documento' }],
    components: {
      securitySchemes: {
        /**
         * El nombre `bearer` no es decorativo: es el que `@ApiBearerAuth()`
         * escribe en cada operación. Sin esta declaración, las operaciones
         * apuntarían a un esquema que el documento no define.
         */
        bearer: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Access token opaco devuelto por `POST /api/v1/auth/signup` y `POST /api/v1/auth/login`. Va en `Authorization: Bearer <token>`.',
        },
      },
    },
  },
})
