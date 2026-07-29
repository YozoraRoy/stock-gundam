#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PPTX 投影片轉圖片後進行 OCR 提取
適用於 SmartArt、圖表等無法直接提取文字的情況
"""

import argparse
import json
import os
import sys
import re
import tempfile
from pathlib import Path


def pptx_to_images(pptx_path: str, output_dir: str) -> list:
    """
    使用 PowerPoint COM 介面將 PPTX 轉換為圖片
    返回圖片路徑列表
    """
    try:
        import comtypes.client
    except ImportError:
        print("請先安裝 comtypes: pip install comtypes")
        return []
    
    pptx_path = os.path.abspath(pptx_path)
    output_dir = os.path.abspath(output_dir)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    try:
        powerpoint = comtypes.client.CreateObject("PowerPoint.Application")
        powerpoint.Visible = 1
        
        presentation = powerpoint.Presentations.Open(pptx_path, WithWindow=False)
        
        images = []
        for i, slide in enumerate(presentation.Slides, 1):
            image_path = os.path.join(output_dir, f"slide_{i:03d}.png")
            slide.Export(image_path, "PNG", 1920, 1080)
            images.append(image_path)
            print(f"  匯出投影片 {i}/{len(presentation.Slides)}")
        
        presentation.Close()
        powerpoint.Quit()
        
        return images
    except Exception as e:
        print(f"PowerPoint COM 錯誤: {e}")
        return []


def ocr_image(image_path: str) -> str:
    """對圖片進行 OCR"""
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        return ""
    
    try:
        image = Image.open(image_path)
        # 使用繁體中文 + 英文
        text = pytesseract.image_to_string(image, lang='chi_tra+eng')
        return text.strip()
    except Exception as e:
        print(f"OCR 錯誤: {e}")
        return ""


def extract_pptx_via_images(pptx_path: str) -> str:
    """將 PPTX 轉為圖片後 OCR 提取"""
    file_name = Path(pptx_path).stem
    
    # 移除 UUID 後綴
    uuid_pattern = r'-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    file_name = re.sub(uuid_pattern, '', file_name)
    
    content = []
    
    # 建立暫存目錄
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"轉換 PPTX 為圖片: {file_name}")
        images = pptx_to_images(pptx_path, temp_dir)
        
        if not images:
            return f"無法轉換 PPTX: {file_name}"
        
        print(f"開始 OCR 處理 {len(images)} 張投影片...")
        
        for i, image_path in enumerate(images, 1):
            print(f"  OCR 投影片 {i}/{len(images)}")
            text = ocr_image(image_path)
            
            if text:
                content.append(f"### 投影片 {i}")
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) > 1:
                        content.append(f"- {line}")
                content.append("")
    
    return "\n".join(content)


def find_department(filename: str, dept_mapping: dict) -> str:
    """根據檔案名稱找出對應的部門"""
    for dept, keywords in dept_mapping.items():
        for keyword in keywords:
            if keyword in filename:
                return dept
    return "其他"


def process_folder(folder_path: str, dept_mapping: dict = None) -> str:
    """處理資料夾中的所有 PPTX 文件"""
    folder = Path(folder_path)
    files = list(folder.glob("*.pptx"))
    
    if not files:
        return "資料夾中沒有找到 PPTX 檔案"
    
    print(f"找到 {len(files)} 個 PPTX 檔案，開始處理...")
    
    if dept_mapping:
        dept_contents = {}
        for i, file in enumerate(files, 1):
            print(f"\n處理中 [{i}/{len(files)}]: {file.name}")
            
            file_name = file.stem
            uuid_pattern = r'-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
            file_name = re.sub(uuid_pattern, '', file_name)
            
            content = extract_pptx_via_images(str(file))
            dept = find_department(file_name, dept_mapping)
            
            if dept not in dept_contents:
                dept_contents[dept] = []
            
            dept_contents[dept].append({
                "name": file_name,
                "content": content
            })
        
        # 組合輸出
        output = []
        for dept in dept_mapping.keys():
            if dept in dept_contents:
                output.append(f"# {dept}\n")
                for doc in dept_contents[dept]:
                    output.append(f"## {doc['name']}\n")
                    output.append(doc['content'])
                    output.append("\n---\n")
        
        if "其他" in dept_contents:
            output.append("# 其他\n")
            for doc in dept_contents["其他"]:
                output.append(f"## {doc['name']}\n")
                output.append(doc['content'])
                output.append("\n---\n")
        
        return "\n".join(output)
    else:
        output = []
        for i, file in enumerate(files, 1):
            print(f"\n處理中 [{i}/{len(files)}]: {file.name}")
            file_name = file.stem
            uuid_pattern = r'-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
            file_name = re.sub(uuid_pattern, '', file_name)
            
            content = extract_pptx_via_images(str(file))
            output.append(f"## {file_name}\n")
            output.append(content)
            output.append("\n---\n")
        return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description='PPTX 轉圖片後進行 OCR 提取 (完整版)'
    )
    parser.add_argument('path', help='PPTX 檔案或資料夾路徑')
    parser.add_argument('-o', '--output', help='輸出檔案路徑')
    parser.add_argument('--group-by-dept', help='部門對應 JSON 檔案路徑')
    
    args = parser.parse_args()
    
    path = Path(args.path)
    
    # 檢查依賴
    try:
        import pytesseract
        from PIL import Image
        import comtypes.client
        print("依賴檢查通過: pytesseract, PIL, comtypes")
    except ImportError as e:
        print(f"缺少依賴: {e}")
        print("請安裝: pip install pytesseract pillow comtypes")
        sys.exit(1)
    
    if path.is_file() and path.suffix.lower() == '.pptx':
        result = extract_pptx_via_images(str(path))
        file_name = path.stem
        uuid_pattern = r'-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        file_name = re.sub(uuid_pattern, '', file_name)
        result = f"## {file_name}\n\n{result}"
    elif path.is_dir():
        dept_mapping = None
        if args.group_by_dept:
            with open(args.group_by_dept, 'r', encoding='utf-8') as f:
                dept_mapping = json.load(f)
        result = process_folder(str(path), dept_mapping)
    else:
        print(f"找不到路徑或不支援的檔案類型: {path}")
        sys.exit(1)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"\n已輸出到: {args.output}")
    else:
        print(result)


if __name__ == '__main__':
    main()
