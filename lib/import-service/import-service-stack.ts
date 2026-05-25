import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

interface ImportServiceStackProps extends cdk.StackProps {
  catalogItemsQueue: sqs.Queue;
  basicAuthorizerFunctionArn: string;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const { catalogItemsQueue, basicAuthorizerFunctionArn } = props;

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
      runtime: Runtime.NODEJS_22_X,
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
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      entry: path.join(__dirname, 'importFileParser.ts'),
      handler: 'main',
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        REGION: this.region,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
      bundling: {
        ...bundling,
        nodeModules: ['csv-parser', 'aws-sdk'],
      },
    });

    // ─── IAM grants ───────────────────────────────────────────────────────
    importBucket.grantPut(importProductsFile);
    importBucket.grantRead(importFileParser);
    importBucket.grantDelete(importFileParser);
    catalogItemsQueue.grantSendMessages(importFileParser);

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

    // Import by ARN to avoid a circular cross-stack dependency; addPermission
    // is a no-op on imported functions so we add the CfnPermission manually below.
    const importedAuthorizerFn = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizerFunction',
      basicAuthorizerFunctionArn,
    );

    const authorizer = new apigateway.TokenAuthorizer(this, 'basicAuthorizer', {
      handler: importedAuthorizerFn,
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(importProductsFile, { proxy: true }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        requestParameters: {
          'method.request.querystring.name': true,
        },
      },
    );

    new lambda.CfnPermission(this, 'BasicAuthorizerPermission', {
      action: 'lambda:InvokeFunction',
      functionName: basicAuthorizerFunctionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: authorizer.authorizerArn,
    });
  }
}

