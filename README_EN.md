# n8n-nodes-douyin-transcript

English | [简体中文](README.md)

This is a custom node package for [n8n](https://n8n.io/) that helps you extract text content from Douyin (TikTok China) videos. The node utilizes Alibaba Cloud's speech model service for accurate video content transcription.

## Features

- Extract video information from Douyin share links
- Transcribe video content using Alibaba Cloud's speech model
- Support for long video processing
- Detailed transcription results with timestamps

## Installation

### Method 1: Install via n8n

1. Open n8n settings panel
2. Go to `Community Nodes` page
3. Search for "n8n-nodes-douyin-transcript"
4. Click install

### Method 2: Manual Installation

Run the following command in your n8n installation directory:

```bash
npm install n8n-nodes-douyin-transcript
```

## Configuration

Before using this node, you need to:

1. Register an Alibaba Cloud account and activate the Dali Yunbailian model service
2. Obtain the following authentication information:
   - API Key

## Usage

1. Add the "douyinTranscript" node in your n8n workflow
2. Configure Alibaba Cloud authentication
3. Input the Douyin video share link
4. Run the workflow and wait for transcription to complete

### Input Format

1. The node accepts Douyin share links or complete sharing text content in the following format:

```
https://v.douyin.com/xxxxx/
```

2. Text extraction uses the `Paraformer-V2` model by default. You can also choose `Paraformer-V1`, but it may have performance issues with long videos. The `Fun-ASR` model is also available as an option.

### Output Format

The node will output transcription results in JSON format:

```json
{
  "download_url": "Video download URL",
  "title": "Video title",
  "fullText": "Complete text content of the video, returned when text extraction is selected",
  "subtitleEntries": [
    {
      "startTime": 0,
      "endTime": 7994,
      "text": "Array of recognized sentences, original information returned by the model, available for secondary processing"
    }
  ],
  "srtSubtitle": "SRT subtitle format text, returned when text extraction is selected"
}
```

## Usage Example

1. **Simple Video Transcription Flow**
   - Add the "douyinTranscript" node
   - Configure video link
   - Connect to text processing node or save results

## FAQ

1. **Q: How long can the videos be?**
   A: Currently supports transcription of videos up to 2 hours in length.

2. **Q: How accurate is the transcription?**
   A: Using Dali Yunbailian's model service, accuracy can reach over 95%.

3. **Q: How fast is the processing?**
   A: Typically takes 10-20 seconds to process 1 minute of video.

## Changelog

Please check [CHANGELOG.md](CHANGELOG.md) for detailed update history.

## Contributing

Issues and Pull Requests are welcome to help improve this project.

## License

This project is licensed under the [MIT](LICENSE) License.

## Contact

For questions or suggestions, please contact through:

- Submit GitHub Issues
- Send email to [feiguan@foxmail.com]

## Acknowledgments

Thanks to the following projects and services:

- [n8n](https://n8n.io/)
- [Dali Yunbailian Model Service](https://www.aliyun.com/product/bailian)
