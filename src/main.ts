import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { expressBind } from 'i18n-2';
import { localize } from './middleware';
import { ValidateInputPipe } from './middleware/validate';
import { AuthModuleGuard } from './middleware/guards';
import { nestwinstonLog, HttpPortLog } from './config/winstonLog';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fs from 'fs';

async function bootstrap() {
  //read ssl config....
  const httpsOptions = {
    key: fs.readFileSync('./ssl/keyfile-encrypted.key'),
    cert: fs.readFileSync('./ssl/97580e4c070d1482.crt'),
    ca: [fs.readFileSync('./ssl/gd1.crt')],
    passphrase: 'Mlajan@123##',
  };

  const NestFactoryOptions = { logger: nestwinstonLog, rawBody: true };

  if (process.env.SSL == 'true') {
    //enable ssl..
    NestFactoryOptions['httpsOptions'] = httpsOptions;
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    NestFactoryOptions,
  );

  // global prefix
  app.setGlobalPrefix('nbapi');

  expressBind(app, { locales: ['en', 'bn'] });

  app.use(localize);

  //handle browser cros..
  app.enableCors();

  // handle all user input validation globally

  app.useGlobalPipes(new ValidateInputPipe());

  //use globally to check auth module from request header
  // app.useGlobalGuards(new AuthModuleGuard())

  //SwaggerModule not use for production...
  if (process.env.NODE_ENV != 'production') {
    const config = new DocumentBuilder()
      .setTitle('NEC Bot API')
      .setDescription('NEC Bot WhatsApp & Support Agent Management API')
      .setVersion('1.0')
      .addTag('Auth')
      .addTag('Chat Activity')
      .addTag('Customer')
      .addTag('Agent')
      .addTag('User')
      .addTag('API Fetch')
      .addTag('App')
      .addBearerAuth({
        description: `Please enter token in format: Bearer <JWT>`,
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      })
      .addBearerAuth({
        description: `Please enter module token in format: Bearer <JWT>`,
        name: 'Module',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      })
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT || 3000, () =>
    HttpPortLog(process.env.PORT || 3000),
  );
}

bootstrap();
