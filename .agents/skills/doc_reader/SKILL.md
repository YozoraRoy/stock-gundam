---
name: doc-reader
description: 讀取 PPTX 和 PDF 文件內容，提取文字（含 OCR 圖片辨識）並轉換為 Markdown 格式
---

# doc-reader

用於讀取 PPTX/PDF 文件並提取文字內容的工具，支援 OCR 圖片文字辨識。

## 依賴安裝

### 基本安裝
```bash
pip install python-pptx pypdf2
```

### OCR 功能（可選，但建議安裝）
```bash
pip install pytesseract pillow
```

**Windows 需額外安裝 Tesseract OCR：**
1. 下載 [Tesseract 安裝檔](https://github.com/UB-Mannheim/tesseract/wiki)
2. 安裝時勾選「Additional language data (download)」→ 選擇「Chinese Traditional」
3. 將安裝路徑加入系統 PATH（預設：`C:\Program Files\Tesseract-OCR`）

## 使用方式

### 基本讀取（含 OCR）

```bash
# 讀取單一檔案
python scripts/extract_doc.py path/to/file.pptx

# 讀取資料夾並依部門分組
python scripts/extract_doc.py path/to/folder -o output.md --group-by-dept departments.json
```

### 進階讀取（含 SmartArt）- 推薦

```bash
# 讀取單一檔案（包含 SmartArt、圖表內容）
python scripts/extract_smartart.py path/to/file.pptx

# 讀取資料夾並依部門分組
python scripts/extract_smartart.py path/to/folder -o output.md --group-by-dept departments.json
```

### 腳本比較

| 腳本 | 功能 | 速度 |
|------|------|------|
| `extract_doc.py` | 文字方塊 + 表格 + OCR 圖片 | 較慢 |
| `extract_smartart.py` | 文字方塊 + 表格 + **SmartArt** + 圖表 XML | **較快** |

## departments.json 格式

用於指定檔案與部門的對應關係：

```json
{
  "電商平台研發部": ["電商平台研發2026"],
  "商城研發部": ["商務系統應用課", "店+系統應用課", "商城應用服務課", "商城交易平台應用課"],
  "電商應用部": ["電商基礎平台課", "折抵應用課", "訂購應用一課", "訂購應用二課", "訂購應用三課", "電子書應用課"]
}
```

## 輸出格式

提取的內容會以 Markdown 格式輸出：

```markdown
# 文件標題

## 投影片 1
- 內容項目
- 內容項目

## 投影片 2
...
```
