import { IExecuteFunctions } from 'n8n-workflow';

// 请求头，模拟移动端访问
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1',
};

/**
 * 解析视频信息
 */
async function parseVideoInfo(
  executeFunctions: IExecuteFunctions,
  videoUrl: string,
  _itemIndex: number,
): Promise<any> {
  try {
    // 提取视频ID
    const videoId = await extractVideoId(executeFunctions, videoUrl);

    // 获取视频信息
    const videoInfo = await fetchVideoInfo(executeFunctions, videoId);

    if (!videoInfo) {
      throw new Error('无法获取视频信息');
    }

    return {
      ...videoInfo,
      shareUrl: videoUrl,
    };
  } catch (error) {
    throw new Error(`解析视频信息失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 提取文本
 */
async function extractText(
  executeFunctions: IExecuteFunctions,
  videoUrl: string,
  itemIndex: number,
): Promise<any> {
  // const cleanup = executeFunctions.getNodeParameter('cleanup', itemIndex) as boolean;
  const recognitionModel = executeFunctions.getNodeParameter(
    'recognitionModel',
    itemIndex,
  ) as string;

  try {
    // 获取API凭证
    const credentials = await executeFunctions.getCredentials('douyinTranscriptApi');
    if (!credentials) {
      throw new Error('未配置API凭证');
    }

    const apiKey = credentials.apiKey as string;

    // 提取视频ID并获取视频信息
    const videoId = await extractVideoId(executeFunctions, videoUrl);
    const videoInfo = await fetchVideoInfo(executeFunctions, videoId);

    if (!videoInfo || !videoInfo.download_url) {
      throw new Error('无法获取视频信息');
    }

    const finalUrl = videoInfo.download_url;

    // 调用阿里云百炼API进行语音识别
    const transcriptResult = await transcribeAudio(
      executeFunctions,
      finalUrl,
      apiKey,
      recognitionModel,
    );

    return {
      success: true,
      ...videoInfo,
      author: videoInfo.author || '',
      duration: transcriptResult.duration || videoInfo.duration || 0,
      // 转录相关信息
      fullText: transcriptResult.fullText || '',
      subtitleEntries: transcriptResult.subtitleEntries || [],
      srtSubtitle: transcriptResult.srtSubtitle || '',
      // 音频属性
      audioFormat: transcriptResult.audioFormat || '',
      samplingRate: transcriptResult.samplingRate || 0,
      channels: transcriptResult.channels || [],
      // transcriptResult,
    };
  } catch (error) {
    throw new Error(`文本提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 从分享链接或文本中提取视频ID
 */
async function extractVideoId(
  executeFunctions: IExecuteFunctions,
  shareTextOrUrl: string,
): Promise<string> {
  // 从输入中提取URL
  let shareUrl = shareTextOrUrl.trim();

  // 如果输入包含多行文本，尝试提取URL
  const urlMatch = shareTextOrUrl.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) {
    shareUrl = urlMatch[1];
  }

  // 检查是否已经是完整的抖音视频URL，直接提取videoId
  if (shareUrl.includes('douyin.com/video/') || shareUrl.includes('iesdouyin.com/share/video/')) {
    const videoIdMatch = shareUrl.match(/\/video\/(\d+)/);
    if (videoIdMatch && videoIdMatch[1]) {
      return videoIdMatch[1];
    }
  }

  let response;
  try {
    response = await executeFunctions.helpers.httpRequest({
      url: shareUrl,
      method: 'GET',
      headers: HEADERS,
      returnFullResponse: true, // 关键：返回完整的响应对象
      disableFollowRedirect: true, // 关键：禁用自动重定向
      timeout: 10000,
    });
  } catch (error: any) {
    // 当禁用重定向时，302状态码会作为错误抛出
    // 我们需要从错误对象中手动提取响应
    if (error.response && (error.response.status === 302 || error.response.status === 301)) {
      response = error.response;
    } else {
      // 对于其他错误，记录并设置为null
      response = null;
    }
  }

  // 如果response为空，说明请求失败，无法继续
  if (!response) {
    throw new Error('无法获取有效的HTTP响应');
  }

  // 手动处理重定向：从响应头的`location`字段获取URL
  const finalUrl = response.headers.location || shareUrl;
  const videoId = finalUrl.split('?')[0].replace(/\/$/, '').split('/').pop();

  // 验证提取的videoId是否为有效的数字
  if (videoId && /^\d+$/.test(videoId) && videoId.length >= 10) {
    return videoId;
  }
  throw new Error('无法从URL中提取有效视频ID');
}

/**
 * 获取视频信息
 */
async function fetchVideoInfo(executeFunctions: IExecuteFunctions, videoId: string): Promise<any> {
  try {
    // 这里应该调用抖音API获取视频信息
    // 由于抖音API需要特殊处理，这里使用模拟数据
    const response = await executeFunctions.helpers.httpRequest({
      url: `https://www.iesdouyin.com/share/video/${videoId}`,
      method: 'GET',
      headers: HEADERS,
    });
    const htmlContent = response;

    // 提取视频信息
    const pattern = /window\._ROUTER_DATA\s*=\s*(.*?)<\/script>/s;
    const match = htmlContent.match(pattern);

    if (!match || !match[1]) {
      throw new Error('从HTML中解析视频信息失败');
    }

    let jsonData;
    try {
      jsonData = JSON.parse(match[1].trim());
    } catch (error) {
      throw new Error(`解析视频信息JSON失败: ${error.message}`);
    }

    const VIDEO_ID_PAGE_KEY = 'video_(id)/page';
    const NOTE_ID_PAGE_KEY = 'note_(id)/page';
    let originalVideoInfo;

    if (jsonData.loaderData && jsonData.loaderData[VIDEO_ID_PAGE_KEY]) {
      originalVideoInfo = jsonData.loaderData[VIDEO_ID_PAGE_KEY].videoInfoRes;
    } else if (jsonData.loaderData && jsonData.loaderData[NOTE_ID_PAGE_KEY]) {
      originalVideoInfo = jsonData.loaderData[NOTE_ID_PAGE_KEY].videoInfoRes;
    } else {
      throw new Error('无法从JSON中解析视频或图集信息');
    }

    if (!originalVideoInfo.item_list || originalVideoInfo.item_list.length === 0) {
      throw new Error('未找到视频项目列表');
    }

    const data = originalVideoInfo.item_list[0];

    if (
      !data.video ||
      !data.video.play_addr ||
      !data.video.play_addr.url_list ||
      data.video.play_addr.url_list.length === 0
    ) {
      throw new Error('未找到视频播放地址');
    }

    // 获取无水印视频链接
    let videoUrl = data.video.play_addr.url_list[0].replace('playwm', 'play');

    // 处理可能的URL问题
    if (!videoUrl.startsWith('http')) {
      videoUrl = `https:${videoUrl}`;
    }

    // 处理标题
    let desc = data.desc ? data.desc.trim() : `douyin_${videoId}`;
    // 替换非法字符
    desc = desc.replace(/[\\/:*?"<>|]/g, '_');

    return {
      download_url: videoUrl,
      title: desc,
      video_id: videoId,
    };
  } catch (error) {
    throw new Error(`获取视频信息失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 使用阿里云百炼API进行语音识别
 */
async function transcribeAudio(
  executeFunctions: IExecuteFunctions,
  videoUrl: string,
  apiKey: string,
  model: string,
): Promise<any> {
  if (!apiKey) {
    throw new Error('未配置API凭证');
  }
  // 提交识别任务
  const taskResponse = await executeFunctions.helpers.httpRequest({
    url: 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Dashscope-Async': 'enable',
    },
    body: {
      model: model || 'paraformer-v2',
      input: {
        file_urls: [videoUrl],
      },
      parameters: {
        timestamp_alignment_enabled: false, // 是否启用时间戳校准功能，可选
        diarization_enabled: false, // 自动说话人分离，可选
        // 'speaker_count': 1 // 说话人数量参考，可选
      },
    },
    json: true, // 自动处理 JSON 请求体和响应
  });
  console.log('提交识别任务响应:', taskResponse);
  const { task_id } = taskResponse.output;

  // 轮询查询任务
  let canContinue = true;
  let statusResponse;
  while (canContinue) {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2秒间隔
    statusResponse = await executeFunctions.helpers.httpRequest({
      url: `https://dashscope.aliyuncs.com/api/v1/tasks/${task_id}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      json: true,
    });
    console.log('查询任务状态响应:', statusResponse);
    const taskStatus = statusResponse.output.task_status;
    // const results = statusResponse.output.results;
    canContinue = taskStatus !== 'SUCCEEDED' && taskStatus !== 'FAILED';
  }

  const { task_status: finalStatus, results } = statusResponse?.output || {};

  if (finalStatus === 'SUCCEEDED' && results?.[0]?.transcription_url) {
    // 下载识别结果
    const fileResponse = await executeFunctions.helpers.httpRequest({
      url: results[0].transcription_url,
      method: 'GET',
      json: true,
    });
    const data = fileResponse;

    // 解析转录结果
    const transcriptResult = parseTranscriptData(data);

    // 检查解析是否成功
    if (!transcriptResult.success) {
      throw new Error(transcriptResult.error || '转录数据解析失败');
    }

    return transcriptResult;
  }

  throw new Error(`语音识别任务失败: ${finalStatus}`);
}

/**
 * 解析语音识别API返回的JSON数据
 * @param data API返回的原始数据
 * @returns 解析后的转录结果
 */
function parseTranscriptData(data: any): any {
  try {
    // 验证输入数据
    if (!data) {
      throw new Error('转录数据为空');
    }

    // 解析JSON数据
    let parsedData: any;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (parseError) {
      throw new Error(
        `JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    // 验证数据结构
    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error('无效的转录数据格式：数据不是有效的对象');
    }

    if (!parsedData.transcripts) {
      throw new Error('无效的转录数据格式：缺少transcripts字段');
    }

    if (!Array.isArray(parsedData.transcripts)) {
      throw new Error('无效的转录数据格式：transcripts不是数组');
    }

    if (parsedData.transcripts.length === 0) {
      throw new Error('转录数据为空：transcripts数组为空');
    }

    // 提取基本信息
    const fileUrl = parsedData.file_url || '';
    const properties = parsedData.properties || {};
    const transcripts = parsedData.transcripts;

    // 提取所有文本内容
    const allTexts: string[] = [];
    const subtitleEntries: Array<{
      startTime: number;
      endTime: number;
      text: string;
      speakerId?: number;
    }> = [];

    // 遍历所有转录通道
    transcripts.forEach((transcript: any, index: number) => {
      try {
        if (!transcript || typeof transcript !== 'object') {
          // console.warn(`跳过无效的转录通道 ${index}: 不是有效对象`);
          return;
        }

        const channelText = transcript.text || '';

        if (channelText) {
          allTexts.push(channelText);
        }

        // 处理句子级别的时间戳信息
        if (transcript.sentences && Array.isArray(transcript.sentences)) {
          transcript.sentences.forEach((sentence: any, sentenceIndex: number) => {
            try {
              if (!sentence || typeof sentence !== 'object') {
                // console.warn(`跳过无效的句子 ${index}-${sentenceIndex}: 不是有效对象`);
                return;
              }

              if (!sentence.text) {
                // console.warn(`跳过空文本句子 ${index}-${sentenceIndex}`);
                return;
              }

              if (sentence.begin_time === undefined || sentence.end_time === undefined) {
                // console.warn(`跳过缺少时间戳的句子 ${index}-${sentenceIndex}`);
                return;
              }

              // 验证时间戳的有效性
              const beginTime = Number(sentence.begin_time);
              const endTime = Number(sentence.end_time);

              if (isNaN(beginTime) || isNaN(endTime)) {
                // console.warn(`跳过时间戳无效的句子 ${index}-${sentenceIndex}`);
                return;
              }

              if (beginTime < 0 || endTime < 0 || beginTime >= endTime) {
                // console.warn(
                //   `跳过时间戳不合理的句子 ${index}-${sentenceIndex}: ${beginTime}-${endTime}`,
                // );
                return;
              }

              subtitleEntries.push({
                startTime: beginTime,
                endTime: endTime,
                text: sentence.text.trim(),
                ...(sentence.speaker_id !== undefined && { speakerId: sentence.speaker_id }),
              });
            } catch (sentenceError) {
              console.warn(`处理句子 ${index}-${sentenceIndex} 时出错:`, sentenceError);
            }
          });
        } else if (transcript.sentences !== undefined) {
          console.warn(`转录通道 ${index} 的sentences字段不是数组`);
        }
      } catch (transcriptError) {
        console.warn(`处理转录通道 ${index} 时出错:`, transcriptError);
      }
    });

    // 验证处理结果
    if (allTexts.length === 0 && subtitleEntries.length === 0) {
      throw new Error('未能提取到任何有效的转录内容');
    }

    // 生成字幕格式文本
    let srtSubtitle = '';

    try {
      srtSubtitle = generateSRTFormat(subtitleEntries);
    } catch (srtError) {
      console.warn('生成SRT格式失败:', srtError);
    }

    return {
      success: true,
      fileUrl,
      properties,
      fullText: allTexts.join('\n'),
      subtitleEntries,
      srtSubtitle,
      duration: properties.original_duration_in_milliseconds || 0,
      channels: properties.channels || [],
      audioFormat: properties.audio_format || '',
      samplingRate: properties.original_sampling_rate || 0,
      originalData: parsedData,
    };
  } catch (error) {
    // 返回错误信息而不是抛出异常，让调用者决定如何处理
    return {
      success: false,
      error: `解析转录数据失败: ${error instanceof Error ? error.message : String(error)}`,
      fullText: '',
      subtitleEntries: [],
      srtSubtitle: '',
      duration: 0,
      audioFormat: '',
      samplingRate: 0,
      channels: [],
      originalData: null,
    };
  }
}

/**
 * 生成SRT格式字幕
 * @param entries 字幕条目数组
 * @returns SRT格式字幕文本
 */
function generateSRTFormat(
  entries: Array<{
    startTime: number;
    endTime: number;
    text: string;
    speakerId?: number;
  }>,
): string {
  return entries
    .map((entry, index) => {
      const startTime = formatSRTTime(entry.startTime);
      const endTime = formatSRTTime(entry.endTime);
      const speakerPrefix = entry.speakerId !== undefined ? `[说话人${entry.speakerId}] ` : '';

      return `${index + 1}\n${startTime} --> ${endTime}\n${speakerPrefix}${entry.text}\n`;
    })
    .join('\n');
}

/**
 * 格式化时间为SRT格式 (HH:MM:SS,mmm)
 * @param milliseconds 毫秒时间戳
 * @returns SRT格式时间字符串
 */
function formatSRTTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export { parseVideoInfo, extractText };
