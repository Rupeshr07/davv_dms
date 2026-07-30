import multer from 'multer'
import { tempUploadRoot } from '../utils/file-storage.js'

export const upload = multer({
  dest: tempUploadRoot,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 20,
  },
})
