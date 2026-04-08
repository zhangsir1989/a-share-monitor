MyData 麦蕊智数 API 文档（Markdown 版）
一、股票列表
API 接口：https://api.mairuiapi.com/hslt/list/您的licence
演示 URL：https://api.mairuiapi.com/hslt/list/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取基础的股票代码和名称，用于后续接口的参数传入。
数据更新：每日 16:20
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	股票代码，如：000001
mc	string	股票名称，如：平安银行
jys	string	交易所，"sh" 表示上证，"sz" 表示深证
二、新股日历
API 接口：https://api.mairuiapi.com/hslt/new/您的licence
演示 URL：https://api.mairuiapi.com/hslt/new/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：新股日历，按申购日期倒序。
数据更新：每日 17:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
zqdm	string	股票代码
zqjc	string	股票简称
sgdm	string	申购代码
fxsl	number	发行总数（股）
swfxsl	number	网上发行（股）
sgsx	number	申购上限（股）
dgsz	number	顶格申购需配市值 (元)
sgrq	string	申购日期
fxjg	number	发行价格（元），null 为 “未知”
zxj	number	最新价（元），null 为 “未知”
srspj	number	首日收盘价（元），null 为 “未知”
zqgbrq	string	中签号公布日，null 为未知
zqjkrq	string	中签缴款日，null 为未知
ssrq	string	上市日期，null 为未知
syl	number	发行市盈率，null 为 “未知”
hysyl	number	行业市盈率
wszql	number	中签率（%），null 为 “未知”
yzbsl	number	连续一字板数量，null 为 “未知”
zf	number	涨幅（%），null 为 “未知”
yqhl	number	每中一签获利（元）
zyyw	string	主营业务
三、概念指数列表（券商数据）
API 接口：https://api.mairuiapi.com/hslt/sectorslist/您的licence
演示 URL：https://api.mairuiapi.com/hslt/sectorslist/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取基础的概念指数代码和名称，用于后续接口的参数传入。
数据更新：每日 16:20
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	概念指数代码，如：101076.BKZS
mc	string	概念指数名称，如：GN 玻璃
jys	string	交易所
四、一级市场板块列表（券商数据）
API 接口：https://api.mairuiapi.com/hslt/primarylist/您的licence
演示 URL：https://api.mairuiapi.com/hslt/primarylist/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取基础的一级市场板块名称，用于后续接口的参数传入。
数据更新：每日 16:20
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
mc	string	一级市场名称，如：1000SW1 基础化工
五、板块明细列表（券商数据）
API 接口：https://api.mairuiapi.com/hslt/sectors/板块指数名称/您的licence
演示 URL：https://api.mairuiapi.com/hslt/sectors/概念指数/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：依据《一级市场板块列表》获取的一级市场板块名称，获取对应的板块列表。
数据更新：每日 16:20
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	板块代码，如：101076.BKZS
mc	string	板块名称，如：GN 玻璃
jys	string	交易所
六、指数、行业、概念树
API 接口：https://api.mairuiapi.com/hszg/list/您的licence
演示 URL：https://api.mairuiapi.com/hszg/list/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取指数、行业、概念（包括基金，债券，美股，外汇，期货，黄金等的代码），其中 isleaf 为 1（叶子节点）的记录的 code（代码）可以作为下方接口的参数传入。
数据更新：每周六 03:05
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
name	string	名称
code	string	代码
type1	number	一级分类（0:A 股，1: 创业板，2: 科创板，3: 基金，4: 香港股市，5: 债券，6: 美国股市，7: 外汇，8: 期货，9: 黄金，10: 英国股市）
type2	number	二级分类
level	number	层级，从 0 开始，根节点为 0
pcode	string	父节点代码
pname	string	父节点名称
isleaf	number	是否为叶子节点，0：否，1：是
七、根据指数、行业、概念找相关股票
API 接口：https://api.mairuiapi.com/hszg/gg/指数代码/您的licence
演示 URL：https://api.mairuiapi.com/hszg/gg/sw_sysh/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：根据 “指数、行业、概念树” 接口得到的代码作为参数，得到相关的股票。
数据更新：每周六 11:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
jys	string	交易所，sh /sz，非 A 股为 null
八、根据股票找相关指数、行业、概念
API 接口：https://api.mairuiapi.com/hszg/zg/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hszg/zg/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：根据《股票列表》得到的股票代码获取所属指数、行业、概念。
数据更新：每周六 11:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
code	string	指数 / 行业 / 概念代码
name	string	指数 / 行业 / 概念名称
九、涨停股池
API 接口：https://api.mairuiapi.com/hslt/ztgc/日期/您的licence
演示 URL：https://api.mairuiapi.com/hslt/ztgc/2024-01-10/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按日期获取涨停股票列表，可获取近 30 天数据。
数据更新：交易时间段每 10 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
p	number	价格
zf	number	涨幅（%）
cje	number	成交额（元）
lt	number	流通市值（元）
zsz	number	总市值（元）
hs	number	换手率（%）
lbc	number	连板数
fbt	string	首次封板时间
lbt	string	最后封板时间
zj	number	封板资金（元）
zbc	number	炸板次数
tj	string	涨停统计
hy	string	所属行业
十、跌停股池
API 接口：https://api.mairuiapi.com/hslt/dtgc/日期/您的licence
演示 URL：https://api.mairuiapi.com/hslt/dtgc/2024-01-10/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按日期获取跌停股票列表，可获取近 30 天数据。
数据更新：交易时间段每 10 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
p	number	价格
zf	number	跌幅（%）
cje	number	成交额（元）
lt	number	流通市值（元）
zsz	number	总市值（元）
pe	number	动态市盈率
hs	number	换手率（%）
lbc	number	连续跌停次数
lbt	string	最后封板时间
zj	number	封单资金（元）
fba	number	板上成交额（元）
zbc	number	开板次数
十一、强势股池
API 接口：https://api.mairuiapi.com/hslt/qsgc/日期/您的licence
演示 URL：https://api.mairuiapi.com/hslt/qsgc/2024-01-10/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按日期获取强势股票列表，可获取近 30 天数据。
数据更新：交易时间段每 10 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
p	number	价格
ztp	number	涨停价
zf	number	涨幅（%）
cje	number	成交额（元）
lt	number	流通市值（元）
zsz	number	总市值（元）
zs	number	涨速（%）
nh	number	是否新高 0/1
lb	number	量比
hs	number	换手率（%）
tj	string	涨停统计
十二、次新股池
API 接口：https://api.mairuiapi.com/hslt/cxgc/日期/您的licence
演示 URL：https://api.mairuiapi.com/hslt/cxgc/2024-01-10/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按日期获取次新股票列表，可获取近 30 天数据。
数据更新：交易时间段每 10 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
p	number	价格
ztp	number	涨停价
zf	number	涨跌幅（%）
cje	number	成交额（元）
lt	number	流通市值（元）
zsz	number	总市值（元）
nh	number	是否新高 0/1
hs	number	转手率（%）
tj	string	涨停统计
kb	number	开板几日
od	string	开板日期
ipod	string	上市日期
十三、炸板股池
API 接口：https://api.mairuiapi.com/hslt/zbgc/日期/您的licence
演示 URL：https://api.mairuiapi.com/hslt/zbgc/2024-01-10/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按日期获取炸板股票列表，可获取近 30 天数据。
数据更新：交易时间段每 10 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
dm	string	代码
mc	string	名称
p	number	价格
ztp	number	涨停价
zf	number	涨跌幅（%）
cje	number	成交额（元）
lt	number	流通市值（元）
zsz	number	总市值（元）
zs	number	涨速（%）
hs	number	转手率（%）
tj	string	涨停统计
fbt	string	首次封板时间
zbc	number	炸板次数
十四、公司简介
API 接口：https://api.mairuiapi.com/hscp/gsjj/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/gsjj/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取上市公司简介、概念、发行信息等。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
name	string	公司名称
ename	string	公司英文名称
market	string	上市市场
idea	string	概念及板块，英文逗号分隔
ldate	string	上市日期 yyyy-MM-dd
sprice	string	发行价格
principal	string	主承销商
rdate	string	成立日期
rprice	string	注册资本
instype	string	机构类型
organ	string	组织形式
secre	string	董事会秘书
phone	string	公司电话
sphone	string	董秘电话
fax	string	公司传真
sfax	string	董秘传真
email	string	公司邮箱
semail	string	董秘邮箱
site	string	公司网站
post	string	邮政编码
infosite	string	信息披露网址
oname	string	证券简称更名历史
addr	string	注册地址
oaddr	string	办公地址
desc	string	公司简介
bscope	string	经营范围
十五、所属指数
API 接口：https://api.mairuiapi.com/hscp/sszs/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/sszs/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取股票所属指数。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
mc	string	指数名称
dm	string	指数代码
ind	string	进入日期
outd	string	退出日期
十六、历届高管 / 董事会 / 监事会成员
API 接口：
高管：https://api.mairuiapi.com/hscp/ljgg/股票代码/您的licence
董事会：https://api.mairuiapi.com/hscp/ljds/股票代码/您的licence
监事会：https://api.mairuiapi.com/hscp/ljjj/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/ljgg/000001/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
name	string	姓名
title	string	职务
sdate	string	起始日期
edate	string	终止日期
十七、近年分红
API 接口：https://api.mairuiapi.com/hscp/jnfh/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/jnfh/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取近年分红实施结果，按公告日期倒序。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
sdate	string	公告日期
give	string	每 10 股送股
change	string	每 10 股转增
send	string	每 10 股派息（税前）
line	string	进度
cdate	string	除权除息日
edate	string	股权登记日
hdate	string	红股上市日
十八、近年增发
API 接口：https://api.mairuiapi.com/hscp/jnzf/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/jnzf/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取近年增发情况，按公告日期倒序。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
sdate	string	公告日期
type	string	发行方式
price	string	发行价格
tprice	string	募集资金总额
fprice	string	发行费用
amount	string	发行数量
十九、解禁限售
API 接口：https://api.mairuiapi.com/hscp/jjxs/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/jjxs/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取解禁限售情况，按解禁日期倒序。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
rdate	string	解禁日期
ramount	number	解禁数量 (万股)
rprice	number	解禁市值 (亿元)
batch	number	上市批次
pdate	string	公告日期
二十、近一年各季度利润 / 现金流
API 接口：
利润：https://api.mairuiapi.com/hscp/jdlr/股票代码/您的licence
现金流：https://api.mairuiapi.com/hscp/jdxj/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/jdlr/000001/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
二十一、近年业绩预告
API 接口：https://api.mairuiapi.com/hscp/yjyg/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/yjyg/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取业绩预告，按公告日期倒序。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
pdate	string	公告日期
rdate	string	报告期
type	string	类型
abs	string	业绩预告摘要
old	string	上年同期每股收益
二十二、财务指标
API 接口：https://api.mairuiapi.com/hscp/cwzb/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/cwzb/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取近四个季度主要财务指标，按报告日期倒序。
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
二十三、十大股东 / 十大流通股东 / 股东变化趋势
API 接口：
十大股东：https://api.mairuiapi.com/hscp/sdgd/股票代码/您的licence
十大流通股东：https://api.mairuiapi.com/hscp/ltgd/股票代码/您的licence
股东变化：https://api.mairuiapi.com/hscp/gdbh/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/sdgd/000001/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 03:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
二十四、基金持股
API 接口：https://api.mairuiapi.com/hscp/jjcg/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hscp/jjcg/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取股票最近 500 家左右基金持股。
数据更新：每周六 18:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
jzrq	string	截止日期
jjmc	string	基金名称
jjdm	string	基金代码
ccsl	number	持仓数量 (股)
ltbl	number	占流通股比例 (%)
cgsz	number	持股市值（元）
jzbl	number	占净值比例（%）
二十五、实时交易数据（网络数据源）
API 接口：https://api.mairuiapi.com/hsrl/ssjy/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hsrl/ssjy/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取实时交易数据（日线最新），网络公开数据源。
数据更新：交易时间段每 1 分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
二十六、当天逐笔交易
API 接口：https://api.mairuiapi.com/hsrl/zbjy/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hsrl/zbjy/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：获取当天逐笔交易数据，按时间倒序。
数据更新：每日 21:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
d	string	数据归属日期 yyyy-MM-dd
t	string	时间 HH:mm:dd
v	number	成交量（股）
p	number	成交价
ts	number	交易方向 0: 中性 1: 买入 2: 卖出
二十七、实时交易数据（券商数据源）
API 接口：https://api.mairuiapi.com/hsstock/real/time/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hsstock/real/time/000001/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
二十八、买卖五档盘口
API 接口：https://api.mairuiapi.com/hsstock/real/five/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hsstock/real/five/000001/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
返回格式：标准 Json 格式 [{},...{}]
表格
字段名称	数据类型	字段说明
ps	number	委卖价
pb	number	委买价
vs	number	委卖量
vb	number	委买量
t	string	更新时间
二十九、实时交易数据（全部 / 多股）
全部（券商）：https://a.mairuiapi.com/hsrl/ssjy/all/您的licence
全部（网络）：https://a.mairuiapi.com/hsrl/real/all/您的licence
多股：https://api.mairuiapi.com/hsrl/ssjy_more/您的licence?stock_codes=代码1,代码2...
说明：一次性获取全市场 / 多股实时数据，全市场接口限包年 / 钻石版 1 分钟 1 次。
数据更新：实时 / 每分钟
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十、资金流向数据
API 接口：https://api.mairuiapi.com/hsstock/history/transaction/股票代码/您的licence?st=开始时间&et=结束时间&lt=条数
演示 URL：https://api.mairuiapi.com/hsstock/history/transaction/000001/LICENCE-66D8-9F96-0C7F0FBCD073
接口说明：按时间获取资金流向，支持特大单 / 大单 / 中单 / 小单。
数据更新：每日 21:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十一、最新 / 历史分时交易
最新分时：https://api.mairuiapi.com/hsstock/latest/股票代码.市场/分时级别/除权方式/您的licence?lt=条数
历史分时：https://api.mairuiapi.com/hsstock/history/股票代码.市场/分时级别/除权方式/您的licence?st=开始&et=结束&lt=条数
分时级别：5/15/30/60 分钟、d 日线、w 周线、m 月线、y 年线
除权方式：n 不复权、f 前复权、b 后复权、fr 等比前复权、br 等比后复权
数据更新：实时 / 盘中 / 每日 15:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十二、历史涨跌停价格
API 接口：https://api.mairuiapi.com/hsstock/stopprice/history/股票代码/您的licence?st=开始&et=结束
演示 URL：https://api.mairuiapi.com/hsstock/stopprice/history/000001.SZ/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 0 点
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十三、行情指标
API 接口：https://api.mairuiapi.com/hsstock/indicators/股票代码/您的licence?st=开始&et=结束
演示 URL：https://api.mairuiapi.com/hsstock/indicators/600519.SH/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 16:30~20:00
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十四、企业版历史数据【1m 级别】
API 接口：https://专属子域名.mairuiapi.com/hsstock/vip/股票代码.市场/分时级别/除权方式/您的licence?st=开始&et=结束&lt=条数
说明：企业版专属，支持 1 分钟级别，最近 3 年分钟数据。
数据更新：实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十五、股票基础信息
API 接口：https://api.mairuiapi.com/hsstock/instrument/股票代码/您的licence
演示 URL：https://api.mairuiapi.com/hsstock/instrument/000001.SZ/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 1 点
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十六、资产负债表 / 利润表 / 现金流量表 / 财务主要指标
API 接口：
资产负债：https://api.mairuiapi.com/hsstock/financial/balance/股票代码/您的licence
利润：https://api.mairuiapi.com/hsstock/financial/income/股票代码/您的licence
现金流：https://api.mairuiapi.com/hsstock/financial/cashflow/股票代码/您的licence
财务指标：https://api.mairuiapi.com/hsstock/financial/pershareindex/股票代码/您的licence
数据更新：每日 0 点
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十七、公司股本表 / 十大股东 / 十大流通股东 / 股东数
API 接口：
股本：https://api.mairuiapi.com/hsstock/financial/capital/股票代码/您的licence
十大股东：https://api.mairuiapi.com/hsstock/financial/topholder/股票代码/您的licence
十大流通股东：https://api.mairuiapi.com/hsstock/financial/flowholder/股票代码/您的licence
股东数：https://api.mairuiapi.com/hsstock/financial/hm/股票代码/您的licence
数据更新：每日 0 点
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十八、历史分时 MACD / MA / BOLL / KDJ（股票）
API 接口：
MACD：https://api.mairuiapi.com/hsstock/history/macd/股票代码.市场/分时级别/除权类型/您的licence
MA：https://api.mairuiapi.com/hsstock/history/ma/股票代码.市场/分时级别/除权类型/您的licence
BOLL：https://api.mairuiapi.com/hsstock/history/boll/股票代码.市场/分时级别/除权类型/您的licence
KDJ：https://api.mairuiapi.com/hsstock/history/kdj/股票代码.市场/分时级别/除权类型/您的licence
数据更新：盘中 / 每日 15:35
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
三十九、沪深主要指数列表
API 接口：https://api.mairuiapi.com/hsindex/list/您的licence
演示 URL：https://api.mairuiapi.com/hsindex/list/LICENCE-66D8-9F96-0C7F0FBCD073
数据更新：每日 0 点
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
表格
字段名称	数据类型	字段说明
dm	string	指数代码，如：000001.SH
mc	string	指数名称，如：上证指数
jys	string	交易所 sh/sz
四十、指数实时 / 最新 / 历史分时
实时：https://api.mairuiapi.com/hsindex/real/time/指数代码/您的licence
最新分时：https://api.mairuiapi.com/hsindex/latest/指数代码.市场/分时级别/您的licence
历史分时：https://api.mairuiapi.com/hsindex/history/指数代码.市场/分时级别/您的licence?st=开始&et=结束
数据更新：实时 / 盘中 / 每日 15:30
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
四十一、指数历史 MACD / MA / BOLL / KDJ
API 接口：
MACD：https://api.mairuiapi.com/hsindex/history/macd/指数代码.市场/分时级别/您的licence
MA：https://api.mairuiapi.com/hsindex/history/ma/指数代码.市场/分时级别/您的licence
BOLL：https://api.mairuiapi.com/hsindex/history/boll/指数代码.市场/分时级别/您的licence
KDJ：https://api.mairuiapi.com/hsindex/history/kdj/指数代码.市场/分时级别/您的licence
数据更新：盘中 / 每日 15:35
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
四十二、京市（北交所）股票 / 指数列表
股票列表：https://api.mairuiapi.com/bj/list/all/您的licence
指数列表：https://api.mairuiapi.com/bj/list/index/您的licence
数据更新：每日 16:20
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
四十三、京市股票 / 指数实时数据、买卖五档
股票实时：https://api.mairuiapi.com/bj/stock/real/time/股票代码/您的licence
五档盘口：https://api.mairuiapi.com/bj/stock/real/five/股票代码/您的licence
指数实时：https://api.mairuiapi.com/bj/index/real/time/指数代码/您的licence
数据更新：实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
四十四、科创股票列表、实时、五档盘口
股票列表：https://api.mairuiapi.com/kc/list/all/您的licence
实时数据：https://api.mairuiapi.com/kc/real/time/股票代码/您的licence
五档盘口：https://api.mairuiapi.com/kc/real/five/股票代码/您的licence
数据更新：实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次
四十五、沪深基金 / ETF 列表、实时数据
沪深基金：https://api.mairuiapi.com/fd/list/all/您的licence
ETF 基金：https://api.mairuiapi.com/fd/list/etf/您的licence
实时数据：https://api.mairuiapi.com/fd/real/time/基金代码/您的licence
数据更新：每日 16:20 / 实时
请求频率：1 分钟 300 次｜包月版、体验版 1 分钟 1 千次｜包年版 1 分钟 3 千次｜钻石版 1 分钟 6 千次