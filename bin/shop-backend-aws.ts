#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductServiceStack } from "../lib/product-service/product-service-stack";
import {TodoStack} from "../lib/todo/TodoStack";

const app = new cdk.App();

new ProductServiceStack(app, 'ProductServiceStack', {});
new TodoStack(app, 'TodoStack');
