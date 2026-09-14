import { execSync } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import path from 'path'

const mp4Path = path.resolve('exports/test_1440p_bottom_center.mp4')
const outFrame = 'C:/Users/htmlp/.gemini/antigravity-ide/brain/1322742a-d3f0-46d8-ae02-931740b98267/test_1440p_frame.png'

execSync(`"${ffmpegPath}" -y -i "${mp4Path}" -vframes 1 "${outFrame}"`)
console.log('Extracted frame to:', outFrame)
