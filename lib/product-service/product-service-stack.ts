import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsList = new lambda.Function(this, 'getProductsList', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'getProductsList.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
    });

    const api = new apigateway.RestApi(this, 'product-service-api', {
      restApiName: 'Product Service API',
      description: 'This API serves the Product Service Lambda functions.',
    });

    const getProductsById = new lambda.Function(this, 'getProductsById', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'getProductsById.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
    });

    const getProductsListIntegration = new apigateway.LambdaIntegration(getProductsList, {
      proxy: true,
    });

    const getProductsByIdIntegration = new apigateway.LambdaIntegration(getProductsById, {
      proxy: true,
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', getProductsListIntegration);

    const productByIdResource = productsResource.addResource('{productId}');
    productByIdResource.addMethod('GET', getProductsByIdIntegration);

    productsResource.addCorsPreflight({
      allowOrigins: [
        'http://localhost:3000',
        'https://d3nv2wihrbag8w.cloudfront.net',
      ],
      allowMethods: ['GET'],
    });
  }
}

