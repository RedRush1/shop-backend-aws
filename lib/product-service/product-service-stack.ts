import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class ProductServiceStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Reference existing DynamoDB tables ───────────────────────────────
    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', 'products');
    const stockTable = dynamodb.Table.fromTableName(this, 'StockTable', 'stock');

    // ─── Shared config ────────────────────────────────────────────────────
    const environment = {
      PRODUCTS_TABLE: productsTable.tableName,
      STOCK_TABLE: stockTable.tableName,
    };

    const bundling = {
      minify: true,
      sourceMap: true,
      target: 'es2022',
      forceDockerBundling: false,
    };

    // ─── Lambda functions ─────────────────────────────────────────────────
    const getProductsList = new NodejsFunction(this, 'getProductsList', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(__dirname, 'getProductsList.ts'),
      handler: 'main',
      environment,
      bundling,
    });

    const getProductsById = new NodejsFunction(this, 'getProductsById', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(__dirname, 'getProductsById.ts'),
      handler: 'main',
      environment,
      bundling,
    });

    const createProduct = new NodejsFunction(this, 'createProduct', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(__dirname, 'createProduct.ts'),
      handler: 'main',
      environment,
      bundling,
    });

    // ─── IAM grants ───────────────────────────────────────────────────────
    productsTable.grantReadData(getProductsList);
    stockTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stockTable.grantReadData(getProductsById);

    productsTable.grantReadWriteData(createProduct);
    stockTable.grantReadWriteData(createProduct);

    this.catalogItemsQueue = new sqs.Queue(this, 'catalogItemsQueue', {
      queueName: 'catalogItemsQueue',
    });

    const createProductTopic = new sns.Topic(this, 'createProductTopic', {
      topicName: 'createProductTopic',
    });

    // Affordable products (price < 100) — rebresh58@gmail.com
    new sns.Subscription(this, 'AffordableProductSubscription', {
      topic: createProductTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: 'rebresh58@gmail.com',
      filterPolicy: {
        price: sns.SubscriptionFilter.numericFilter({ lessThan: 100 }),
      },
    });

    // Premium products (price >= 100) — rebresh58+premium@gmail.com
    // Gmail delivers +alias addresses to the same inbox; SNS treats them as distinct endpoints.
    new sns.Subscription(this, 'PremiumProductSubscription', {
      topic: createProductTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: 'rebresh58+premium@gmail.com',
      filterPolicy: {
        price: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: 100 }),
      },
    });

    const catalogBatchProcess = new NodejsFunction(this, 'catalogBatchProcess', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(__dirname, 'catalogBatchProcess.ts'),
      handler: 'main',
      environment: {
        ...environment,
        CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
      },
      bundling,
    });

    catalogBatchProcess.addEventSource(new SqsEventSource(this.catalogItemsQueue, { batchSize: 5 }));

    productsTable.grantReadWriteData(catalogBatchProcess);
    stockTable.grantReadWriteData(catalogBatchProcess);
    createProductTopic.grantPublish(catalogBatchProcess);

    // ─── API Gateway ──────────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'product-service-api', {
      restApiName: 'Product Service API',
      description: 'This API serves the Product Service Lambda functions.',
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsList, { proxy: true }));
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProduct, { proxy: true }));

    const productByIdResource = productsResource.addResource('{productId}');
    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsById, { proxy: true }));

    productsResource.addCorsPreflight({
      allowOrigins: [
        'http://localhost:3000',
        'https://d3nv2wihrbag8w.cloudfront.net',
      ],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    });

    productByIdResource.addCorsPreflight({
      allowOrigins: [
        'http://localhost:3000',
        'https://d3nv2wihrbag8w.cloudfront.net',
      ],
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    });
  }
}
