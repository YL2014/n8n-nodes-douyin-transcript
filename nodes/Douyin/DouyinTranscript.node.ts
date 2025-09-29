import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

import { extractText, parseVideoInfo } from './utils';

export class DouyinTranscript implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'douyinTranscript',
    name: 'douyinTranscript',
    icon: 'file:douyin.svg',
    group: ['transform'],
    version: 1,
    description: '抖音视频下载、解析和转录工具',
    defaults: {
      name: 'douyinTranscript',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'douyinTranscriptApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: '操作',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: '解析视频信息',
            value: 'parseVideoInfo',
            description: '解析抖音视频的基本信息',
            action: '解析抖音视频的基本信息',
          },
          {
            name: '提取文本',
            value: 'extractText',
            description: '将抖音视频转换为文本',
            action: '将抖音视频转换为文本',
          },
        ],
        default: 'parseVideoInfo',
      },
      {
        displayName: '视频URL或分享文本',
        name: 'videoUrl',
        type: 'string',
        required: true,
        default: '',
        placeholder:
          '例如：https://v.douyin.com/xxx 或 "复制链接打开抖音，直接观看视频！https://v.douyin.com/xxx"',
        description: '抖音视频的完整URL或包含分享链接的文本内容',
      },
      {
        displayName: '语音识别模型',
        name: 'recognitionModel',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['extractText'],
          },
        },
        options: [
          {
            name: 'Paraformer-V1',
            value: 'paraformer-v1',
          },
          {
            name: 'Paraformer-V2',
            value: 'paraformer-v2',
          },
          {
            name: 'Fun-ASR',
            value: 'fun-asr',
          },
        ],
        default: 'paraformer-v2',
        description:
          '使用的语音识别模型，参考：https://help.aliyun.com/zh/model-studio/recording-file-recognition',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const videoUrl = this.getNodeParameter('videoUrl', i) as string;

      let result: any;

      switch (operation) {
        case 'parseVideoInfo':
          result = await parseVideoInfo(this, videoUrl, i);
          break;
        case 'extractText':
          result = await extractText(this, videoUrl, i);
          break;
        default:
          throw new Error(`未知操作: ${operation}`);
      }

      returnData.push({
        json: result,
        pairedItem: { item: i },
      });
    }

    return [returnData];
  }
}
