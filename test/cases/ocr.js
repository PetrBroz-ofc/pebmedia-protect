/* Testy zpracování textu z OCR (bez prohlížeče a bez Tesseractu).
 * Skutečný běh OCR na obrázcích ověřuje test/browser/ocr.py.
 */
module.exports = {
  normalize: [
    { id: 'missing-colon', input: 'Zaplaťte: https//zasilkovna-platba.top/z/1', mustContainUrl: 'zasilkovna-platba.top',
      why: 'OCR často vynechá dvojtečku za https.' },
    { id: 'wrapped-dot', input: 'Zaplaťte:\nhttps://zasilkovna-platba\n.top/z/88123', mustContainUrl: 'zasilkovna-platba.top',
      why: 'Odkaz zalomený přes dva řádky na hranici tečky.' },
    { id: 'wrapped-path', input: 'Sledujte https://ceskaposta-doruceni.top/cz/\ntrack?id=88231', mustContainUrl: 'ceskaposta-doruceni.top',
      why: 'Odkaz zalomený v cestě.' },
    { id: 'normal-lines', input: 'Dobrý den,\nzásilka je na cestě.\nDěkujeme', mustEqual: 'Dobrý den,\nzásilka je na cestě.\nDěkujeme',
      why: 'Běžné řádky se nesmí slepit.' }
  ],
  readability: [
    { id: 'clear-sms', confidence: 91, readable: true,
      text: 'Česká pošta: Vaše zásilka nemohla být doručena, adresa je neúplná. Uhraďte doplatek 1,50 Kč do 24 hodin: https://ceskaposta-doruceni.top/cz/track',
      why: 'Čistý screenshot.' },
    { id: 'noise-high-conf', confidence: 72, readable: false,
      text: 'L“ R Re Be LA EA TE M -k Vb AoE IY vk TA Sra +., boky R o TA a LR CI Rl en Cie Sard - BIA AL eI Ca AT -130 K4 SA eu ka: fre 2 Rear FE YL',
      why: 'Šum přečtený jako písmena. Jistota OCR sama nestačí.' },
    { id: 'noise-low-conf', confidence: 31, readable: false,
      text: 'Te Ao al Apa SHAN Kým Ad ER Slax: Co ay k',
      why: 'Nízká jistota i nesmyslná slova.' },
    { id: 'short', confidence: 95, readable: false, text: 'OK 12',
      why: 'Příliš málo textu na posouzení.' },
    { id: 'clear-low-conf', confidence: 40, readable: false,
      text: 'Vaše zásilka čeká na doplatek. Zaplaťte zde: https://posta-platba.top',
      why: 'Text dává smysl, ale OCR si je velmi nejisté. Raději požádat o kontrolu textu.' },
    { id: 'english', confidence: 88, readable: true,
      text: 'DHL Express: Your parcel is on hold due to unpaid customs fee of 2.99 EUR. Pay within 24 hours: https://dhl-customs-pay.com/track',
      why: 'Anglická zpráva.' }
  ]
};
