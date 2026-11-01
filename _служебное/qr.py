# -*- coding: utf-8 -*-
# QR-код со ссылкой на приложение — навести камеру телефона. Запуск: LibreOffice python.exe qr.py
import os
import segno

URL = 'https://pavelgenikh-ops.github.io/mesyac-chteniya/'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'QR-код для телефона.svg')
segno.make(URL, error='m').save(out, scale=12, border=4, dark='#1C2738', light='#FCFCFA')
print('ok', os.path.abspath(out))
