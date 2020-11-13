import { launch, Page } from "puppeteer";

/** ログイン処理 */
const authorization = async (page: Page) => {
  // ログインページに遷移
  await page.goto("https://ssl.jobcan.jp/login/client/");
  await page.type("#client_login_id", process.env.CLIENT_LOGIN_ID); // 勤務会社ID
  await page.type(
    "#client_manager_login_id",
    process.env.CLIENT_MANAGER_LOGIN_ID
  ); // グループ管理者ログインID
  await page.type("#client_login_password", process.env.CLIENT_LOGIN_PASSWORD); // パスワード
  const elementHandle = await page.$("#client_login_password");
  await elementHandle.press("Enter");
  await page.waitForNavigation({
    waitUntil: "networkidle0",
  });
};

interface EmployeeInterface {
  employeeId: string;
  appliedId: string;
  offset: string;
  name: string;
}

/** 休暇申請一覧 */
const holidayAppliedEntry = async (page: Page) => {
  // 休暇申請一覧に遷移
  await page.goto("https://ssl.jobcan.jp/client/employee-holiday-applied");
  const params = await getRequestList(page);
  return params.map((param) => ({
    name: param.name,
    url: `https://ssl.jobcan.jp/client/employee-over-work-applied/detail/?employee_id=${param.employeeId}&applied_id=${param.appliedId}&offset=${param.offset}`,
  }));
};

/** 残業申請一覧 */
const overWorkAppliedEntry = async (page: Page) => {
  // 残業申請一覧に遷移
  await page.goto("https://ssl.jobcan.jp/client/employee-over-work-applied");
  const params = await getRequestList(page);
  return params.map((param) => ({
    name: param.name,
    url: `https://ssl.jobcan.jp/client/employee-over-work-applied/detail/?employee_id=${param.employeeId}&applied_id=${param.appliedId}&offset=${param.offset}`,
  }));
};

const getRequestList = async (page: Page): Promise<EmployeeInterface[]> => {
  // 名前の一覧を取得
  const names = await page.$$eval(
    "#applied-list > tr.applied-row > td:nth-child(3)",
    (tds) =>
      tds.map((td: HTMLTableDataCellElement) => {
        // 休暇申請と残業申請でDOMの構成が異なるので分岐
        // 残業申請
        if (td.querySelector("span:nth-child(1)")) {
          const span = td.querySelector("span:nth-child(1)");
          return span.innerHTML;
        }
        // 休暇申請
        return td.innerText;
      })
  );

  // パラメータ一覧を取得
  const params = await page.$$eval(
    "#applied-list > tr.applied-row > td > input.btn",
    (buttons) => {
      return buttons.map((button: HTMLButtonElement) => {
        const [_, employeeId, appliedId, offset] = button.outerHTML.match(
          /.*showDetail\((\d+), (\d+), (\d+)/
        );
        return { employeeId, appliedId, offset };
      });
    }
  );

  // 名前とパラメータをマージ
  const mergeParams = names.map((name, i) => ({ name, ...params[i] }));

  // 次のページを取得
  const pager = await page.$(".pager > :nth-last-child(2)");
  const nextPage = await (await pager?.getProperty("href"))?.jsonValue();

  // 次のページがある場合は再帰的呼び出しでループ
  if (nextPage) {
    await page.goto(nextPage as string);
    console.log("nextPage");
    const loopParams = await getRequestList(page);
    return [...mergeParams, ...loopParams];
  }

  return mergeParams;
};

const main = async () => {
  const browser = await launch();
  const page = await browser.newPage();

  await authorization(page);
  const holidayAppliedList = await holidayAppliedEntry(page);
  const overWorkAppliedList = await overWorkAppliedEntry(page);

  console.log("【休暇申請】");
  holidayAppliedList
    // 名前順にソート
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .forEach((param) => {
      console.log(`${param.name}: ${param.url}`);
    });

  console.log("【残業申請】");
  overWorkAppliedList
    // 名前順にソート
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .forEach((param) => {
      console.log(`${param.name}: ${param.url}`);
    });

  await browser.close();
};

(async () => {
  main();
})();
