import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class ProductServiceStack extends cdk.Stack {
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
