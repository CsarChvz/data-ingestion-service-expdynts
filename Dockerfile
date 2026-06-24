FROM public.ecr.aws/lambda/nodejs:22

# Establecer directorio de trabajo en Lambda
WORKDIR ${LAMBDA_TASK_ROOT}

# Copiar archivos de dependencias
COPY package*.json ${LAMBDA_TASK_ROOT}
COPY tsconfig.json ${LAMBDA_TASK_ROOT}

# Instalar dependencias (incluyendo devDependencies para tsc)
RUN npm install

# Copiar el resto del código
COPY . ${LAMBDA_TASK_ROOT}

# Compilar TypeScript -> dist/
RUN npm run build

# Establecer el handler de Lambda (desde dist/)
CMD [ "dist/app.handler" ]
