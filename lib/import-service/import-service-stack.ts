import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── S3 Bucket ────────────────────────────────────────────────────────
    const importBucket = new s3.Bucket(this, 'ImportBucket', {
      bucketName: `import-service-bucket-${this.account}-${this.region}`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ─── Shared config ────────────────────────────────────────────────────
    const bundling = {
      minify: true,
      sourceMap: true,
      target: 'es2022',
      forceDockerBundling: false,
    };

    // ─── Lambda: importProductsFile ───────────────────────────────────────
    const importProductsFile = new NodejsFunction(this, 'importProductsFile', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      entry: path.join(__dirname, 'importProductsFile.ts'),
      handler: 'main',
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        REGION: this.region,
      },
      bundling,
    });

    // ─── Lambda: importFileParser ─────────────────────────────────────────
    const importFileParser = new NodejsFunction(this, 'importFileParser', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      entry: path.join(__dirname, 'importFileParser.ts'),
      handler: 'main',
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        REGION: this.region,
      },
      bundling: {
        ...bundling,
        nodeModules: ['csv-parser'],
      },
    });

    // ─── IAM grants ───────────────────────────────────────────────────────
    importBucket.grantPut(importProductsFile);
    importBucket.grantRead(importFileParser);
    importBucket.grantDelete(importFileParser);

    // ─── S3 Event: trigger importFileParser on uploaded/ prefix ───────────
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: 'uploaded/' },
    );

    // ─── API Gateway ──────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'import-service-api', {
      restApiName: 'Import Service API',
      description: 'This API serves the Import Service Lambda functions.',
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'http://localhost:3000',
          'https://d3nv2wihrbag8w.cloudfront.net',
        ],
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(importProductsFile, { proxy: true }),
      {
        requestParameters: {
          'method.request.querystring.name': true,
        },
      },
    );
  }
}

