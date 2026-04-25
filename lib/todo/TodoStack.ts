// Filename: Todo/TodoStack.ts
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cdk from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';

const TableName = 'Todos';

export class TodoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const todosTable = new dynamodb.Table(this, "Todos", {
      tableName: TableName,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "createdAt",
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    const addTodoLambda = new NodejsFunction(this, 'lambda-function', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      entry: join(__dirname, 'handler.ts'),
      handler: 'addTodo',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        forceDockerBundling: false,
      },
      environment: {
        TABLE_NAME: TableName
      }
    });

    todosTable.grantWriteData(addTodoLambda);
  }
}