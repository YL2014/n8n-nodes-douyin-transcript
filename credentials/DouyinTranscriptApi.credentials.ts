import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class DouyinTranscriptApi implements ICredentialType {
  name = 'douyinTranscriptApi';
  displayName = '抖音转录密钥 API';
  documentationUrl = 'https://help.aliyun.com/zh/model-studio/get-api-key';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: '阿里云百炼 API 密钥',
    },
  ];
}
