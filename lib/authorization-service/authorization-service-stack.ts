import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

function loadEnv(envPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  } catch {}
  return result;
}

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bundling = {
      minify: true,
      sourceMap: true,
      target: 'es2022',
      forceDockerBundling: false,
    };

    this.basicAuthorizerFunction = new NodejsFunction(this, 'basicAuthorizer', {
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(__dirname, 'basicAuthorizer.ts'),
      handler: 'main',
      environment: loadEnv(path.join(__dirname, '../../.env')),
      bundling,
    });
  }
}
