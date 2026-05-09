#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductServiceStack } from "../lib/product-service/product-service-stack";
import { TodoStack } from "../lib/todo/TodoStack";
import { ImportServiceStack } from "../lib/import-service/import-service-stack";

const app = new cdk.App();

new ProductServiceStack(app, 'ProductServiceStack', {});
new TodoStack(app, 'TodoStack');
new ImportServiceStack(app, 'ImportServiceStack', {});
