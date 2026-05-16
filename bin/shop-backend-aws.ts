#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductServiceStack } from "../lib/product-service/product-service-stack";
import { ImportServiceStack } from "../lib/import-service/import-service-stack";

const app = new cdk.App();

const productServiceStack = new ProductServiceStack(app, 'ProductServiceStack', {});
new ImportServiceStack(app, 'ImportServiceStack', {
  catalogItemsQueue: productServiceStack.catalogItemsQueue,
});
