async (page) => {
  return await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.ir-job-card')).find(c => c.innerText.indexOf('鸿蒙') >= 0);
    if(!card) return 'not found';
    card.click();
    const ov = document.querySelector('.ir-overview');
    const panoTitle = document.querySelector('.ir-pano-core .tt')?.innerText;
    return { active: card.classList.contains('active'), ovTitle: ov?.querySelector('.ir-panel-h .t')?.innerText, panoTitle, cardName: card.querySelector('.ir-job-card-row1')?.innerText?.trim() };
  });
}
