import { expect, test } from 'vitest'
import { detectLanguage } from './detect'

const SAMPLES: [string, string][] = [
  ['bash', '#!/usr/bin/env bash\nset -e\necho hi'],
  ['bash', 'curl -s localhost:8000/health'],
  ['bash', '$ docker compose up --build'],
  ['python', '#!/usr/bin/env python3\nprint(1)'],
  ['python', 'def greet(name):\n    return f"Hi, {name}"'],
  ['python', 'from app.domain import boards\n\nboards.save()'],
  ['json', '{"name": "tiko", "port": 3000}'],
  ['yaml', 'services:\n  web:\n    image: tiko-web\n    ports:\n      - 3000:3000'],
  ['sql', 'SELECT id, name\nFROM users\nWHERE active = true;'],
  ['go', 'package main\n\nfunc main() {\n\tfmt.Println("hi")\n}'],
  ['rust', 'fn main() {\n    let mut x = 1;\n    println!("{}", x);\n}'],
  ['typescript', 'interface User {\n  id: string\n}'],
  ['typescript', 'const add = (a: number, b: number) => a + b'],
  ['tsx', 'export function Card({ title }: Props) {\n  return <Panel title={title} />\n}'],
  ['javascript', 'const x = require("fs")\nconsole.log(x)'],
  ['dockerfile', 'FROM python:3.13-slim\nWORKDIR /app\nRUN pip install uv'],
  ['hcl', 'resource "aws_s3_bucket" "logs" {\n  bucket = "logs"\n}'],
  ['php', '<?php\necho "hi";'],
  ['html', '<!doctype html>\n<html><body></body></html>'],
  ['xml', '<?xml version="1.0"?>\n<note></note>'],
  ['java', 'public class Main {\n  public static void main(String[] args) {}\n}'],
  ['csharp', 'using System;\nConsole.WriteLine("hi");'],
  ['cpp', '#include <iostream>\nint main() { std::cout << 1; }'],
  ['c', '#include <stdio.h>\nint main() { printf("1"); }'],
  ['css', '.card {\n  color: red;\n}'],
  ['toml', '[tool.ruff]\nline-length = 100'],
  ['markdown', '# Title\n\nSome text'],
  ['graphql', 'query Board($id: ID!) {\n  board(id: $id) { name }\n}'],
  ['powershell', 'Get-ChildItem -Path C:\\ | Write-Output'],
  ['kotlin', 'fun main() {\n    val x = 1\n}'],
  ['ruby', 'def hi\n  puts "hi"\nend'],
]

test.each(SAMPLES)('finds %s', (language, code) => {
  expect(detectLanguage(code)).toBe(language)
})

test('says plain text when nothing is sure', () => {
  expect(detectLanguage('Ask legal about the export')).toBe('plain')
  expect(detectLanguage('Todo: ask legal about the export')).toBe('plain')
  expect(detectLanguage('  ')).toBe('plain')
})
