#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductServiceStack } from "../lib/product-service/product-service-stack";

const app = new cdk.App();

new ProductServiceStack(app, 'ProductServiceStack', {});
