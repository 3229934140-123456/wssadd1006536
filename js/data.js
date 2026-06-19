const mockPatients = [
    {
        id: 'P2024001',
        name: '王建国',
        gender: '男',
        age: 45,
        riskLevel: 'periodontitis',
        riskLabel: '疑似牙周炎',
        lastVisit: '2026-05-15',
        status: 'watch',
        plaqueControl: 65,
        plaqueLevel: 'moderate',
        bleedingSites: '6个位点探诊出血',
        bleedingNote: '下颌前牙区及左上后牙区牙龈红肿，探诊深度3-5mm',
        lastCleaning: '2026-05-15',
        doctor: '张医生',
        prescription: '巴氏刷牙法，每日两次，每次3分钟；牙线每日使用一次；含氯己定漱口水，每日两次，使用一周。',
        photos: 4,
        history: [
            { date: '2026-05-15', event: '首次洁治+牙周探诊', doctor: '张医生', note: '全口洁治，6个位点PD>4mm，BOP(+)' },
            { date: '2026-03-20', event: '初诊检查', doctor: '李医生', note: '诊断为慢性牙周炎，建议系统治疗' }
        ]
    },
    {
        id: 'P2024002',
        name: '刘美华',
        gender: '女',
        age: 32,
        riskLevel: 'gingivitis',
        riskLabel: '轻度牙龈炎',
        lastVisit: '2026-06-01',
        status: 'good',
        plaqueControl: 85,
        plaqueLevel: 'good',
        bleedingSites: '2个位点轻微出血',
        bleedingNote: '牙龈缘轻度红肿，探诊深度均<3mm，无附着丧失',
        lastCleaning: '2026-06-01',
        doctor: '张医生',
        prescription: '保持良好口腔卫生，使用软毛牙刷，每年洁治1-2次。',
        photos: 3,
        history: [
            { date: '2026-06-01', event: '预防性洁治', doctor: '张医生', note: '全口洁治抛光，口腔卫生指导' }
        ]
    },
    {
        id: 'P2024003',
        name: '陈志强',
        gender: '男',
        age: 58,
        riskLevel: 'implant',
        riskLabel: '种植体周围维护',
        lastVisit: '2026-04-28',
        status: 'watch',
        plaqueControl: 55,
        plaqueLevel: 'moderate',
        bleedingSites: '种植体周围探诊出血',
        bleedingNote: '右下4号种植体周围黏膜充血，探诊深度4mm，建议加强清洁',
        lastCleaning: '2026-04-28',
        doctor: '王医生',
        prescription: '种植体专用牙刷，每日两次；冲牙器每日使用，重点清洁种植体周；每3个月复查一次。',
        photos: 5,
        history: [
            { date: '2026-04-28', event: '种植体维护洁治', doctor: '王医生', note: '种植体周洁治，钛刮治器使用' },
            { date: '2025-12-15', event: '种植体植入', doctor: '王医生', note: '右下4号种植体植入，愈合良好' }
        ]
    },
    {
        id: 'P2024004',
        name: '周小婷',
        gender: '女',
        age: 26,
        riskLevel: 'ortho',
        riskLabel: '正畸洁治后',
        lastVisit: '2026-06-10',
        status: 'good',
        plaqueControl: 70,
        plaqueLevel: 'good',
        bleedingSites: '少量位点出血',
        bleedingNote: '托槽周围牙龈轻度增生，建议加强清洁',
        lastCleaning: '2026-06-10',
        doctor: '李医生',
        prescription: '正畸专用牙刷+牙缝刷，每餐后刷牙；冲牙器辅助清洁；每3个月洁治一次。',
        photos: 4,
        history: [
            { date: '2026-06-10', event: '正畸期间洁治', doctor: '李医生', note: '托槽周围洁治抛光，口腔卫生指导' },
            { date: '2026-03-05', event: '正畸治疗开始', doctor: '赵医生', note: '固定矫治器佩戴中' }
        ]
    },
    {
        id: 'P2024005',
        name: '赵文博',
        gender: '男',
        age: 52,
        riskLevel: 'periodontitis',
        riskLabel: '疑似牙周炎',
        lastVisit: '2026-05-20',
        status: 'attention',
        plaqueControl: 40,
        plaqueLevel: 'poor',
        bleedingSites: '12个位点探诊出血',
        bleedingNote: '全口牙龈红肿明显，多个位点PD>6mm，牙齿松动Ⅰ-Ⅱ度',
        lastCleaning: '2026-05-20',
        doctor: '张医生',
        prescription: '加强口腔卫生，使用电动牙刷；牙线+牙缝刷每日使用；含氯己定漱口水；尽快复诊评估龈下刮治。',
        photos: 6,
        history: [
            { date: '2026-05-20', event: '初步洁治+检查', doctor: '张医生', note: '全口洁治，PD多处>5mm，建议系统牙周治疗' },
            { date: '2025-11-10', event: '上次洁治', doctor: '李医生', note: '牙龈炎，建议定期复查' }
        ]
    },
    {
        id: 'P2024006',
        name: '孙雅琴',
        gender: '女',
        age: 38,
        riskLevel: 'gingivitis',
        riskLabel: '轻度牙龈炎',
        lastVisit: '2026-06-05',
        status: 'good',
        plaqueControl: 90,
        plaqueLevel: 'good',
        bleedingSites: '无出血',
        bleedingNote: '牙龈色泽正常，质地坚韧，探诊深度均<2mm',
        lastCleaning: '2026-06-05',
        doctor: '张医生',
        prescription: '维持良好口腔卫生习惯，每6个月定期复查洁治。',
        photos: 2,
        history: [
            { date: '2026-06-05', event: '定期洁治', doctor: '张医生', note: '口腔卫生状况良好' },
            { date: '2025-12-05', event: '半年复查', doctor: '张医生', note: '牙龈健康' }
        ]
    },
    {
        id: 'P2024007',
        name: '李援朝',
        gender: '男',
        age: 65,
        riskLevel: 'implant',
        riskLabel: '种植体周围维护',
        lastVisit: '2026-03-15',
        status: 'attention',
        plaqueControl: 35,
        plaqueLevel: 'poor',
        bleedingSites: '种植体周溢脓',
        bleedingNote: '左上6号种植体周围黏膜红肿溢脓，探诊深度7mm，X线示种植体周围骨吸收',
        lastCleaning: '2026-03-15',
        doctor: '王医生',
        prescription: '种植体周专业清洁；局部用药；建议种植体周炎治疗方案。',
        photos: 4,
        history: [
            { date: '2026-03-15', event: '种植体复查', doctor: '王医生', note: '种植体周围炎，建议治疗' },
            { date: '2025-09-20', event: '种植体维护', doctor: '王医生', note: '状况良好' },
            { date: '2024-06-10', event: '种植体植入', doctor: '王医生', note: '左上6号种植' }
        ]
    },
    {
        id: 'P2024008',
        name: '吴思雨',
        gender: '女',
        age: 22,
        riskLevel: 'ortho',
        riskLabel: '正畸洁治后',
        lastVisit: '2026-06-12',
        status: 'watch',
        plaqueControl: 50,
        plaqueLevel: 'moderate',
        bleedingSites: '多处牙龈红肿出血',
        bleedingNote: '托槽周围菌斑堆积明显，牙龈增生明显，口腔卫生需加强',
        lastCleaning: '2026-06-12',
        doctor: '李医生',
        prescription: '正畸牙刷+牙缝刷+冲牙器联合使用；每餐后必须刷牙；每2-3个月复查洁治。',
        photos: 3,
        history: [
            { date: '2026-06-12', event: '正畸洁治', doctor: '李医生', note: '全口洁治，口腔卫生宣教' },
            { date: '2025-08-20', event: '正畸开始', doctor: '赵医生', note: '不拔牙矫治' }
        ]
    },
    {
        id: 'P2024009',
        name: '郑海涛',
        gender: '男',
        age: 48,
        riskLevel: 'periodontitis',
        riskLabel: '疑似牙周炎',
        lastVisit: '2026-05-08',
        status: 'watch',
        plaqueControl: 58,
        plaqueLevel: 'moderate',
        bleedingSites: '8个位点出血',
        bleedingNote: '后牙区探诊深度4-5mm，牙龈退缩约2mm，牙齿敏感',
        lastCleaning: '2026-05-08',
        doctor: '张医生',
        prescription: '巴氏刷牙法，使用脱敏牙膏；牙线每日使用；抗敏感漱口水。',
        photos: 5,
        history: [
            { date: '2026-05-08', event: '洁治+牙周评估', doctor: '张医生', note: '中度牙周炎可能，需进一步检查' },
            { date: '2025-10-15', event: '上次洁治', doctor: '李医生', note: '牙龈炎' }
        ]
    },
    {
        id: 'P2024010',
        name: '黄丽娟',
        gender: '女',
        age: 42,
        riskLevel: 'gingivitis',
        riskLabel: '轻度牙龈炎',
        lastVisit: '2026-06-08',
        status: 'good',
        plaqueControl: 78,
        plaqueLevel: 'good',
        bleedingSites: '1个位点出血',
        bleedingNote: '下前牙舌侧轻度牙龈炎，可能与刷牙方式有关',
        lastCleaning: '2026-06-08',
        doctor: '李医生',
        prescription: '调整刷牙方式，重点清洁下前牙区域；使用牙线。',
        photos: 2,
        history: [
            { date: '2026-06-08', event: '年度洁治', doctor: '李医生', note: '轻度牙龈炎，口腔卫生指导' }
        ]
    }
];

const followupQuestions = {
    brushingMethod: {
        label: '刷牙方式',
        options: [
            { value: 'bass', label: '巴氏刷牙法' },
            { value: 'vertical', label: '竖刷法' },
            { value: 'horizontal', label: '横刷法' },
            { value: 'electric', label: '电动牙刷' },
            { value: 'unclear', label: '不清楚/不规范' }
        ]
    },
    brushingFrequency: {
        label: '刷牙频率',
        options: [
            { value: 'twice', label: '每日2次及以上' },
            { value: 'once', label: '每日1次' },
            { value: 'irregular', label: '不规律' }
        ]
    },
    flossUse: {
        label: '牙线/牙缝刷使用',
        options: [
            { value: 'daily', label: '每天使用' },
            { value: 'weekly', label: '每周几次' },
            { value: 'rarely', label: '偶尔使用' },
            { value: 'never', label: '从不使用' }
        ]
    },
    irrigatorUse: {
        label: '冲牙器使用',
        options: [
            { value: 'daily', label: '每天使用' },
            { value: 'weekly', label: '每周几次' },
            { value: 'rarely', label: '偶尔使用' },
            { value: 'never', label: '没有/从不使用' }
        ]
    },
    bleedingChange: {
        label: '出血变化',
        options: [
            { value: 'improve', label: '明显好转' },
            { value: 'slight', label: '略有好转' },
            { value: 'same', label: '无明显变化' },
            { value: 'worse', label: '有所加重' }
        ]
    },
    gumCondition: {
        label: '牙龈状况',
        multi: true,
        options: [
            { value: 'red', label: '牙龈红肿' },
            { value: 'bleeding', label: '刷牙出血' },
            { value: 'pus', label: '溢脓' },
            { value: 'recession', label: '牙龈退缩' },
            { value: 'sensitive', label: '牙齿敏感' },
            { value: 'loose', label: '牙齿松动' },
            { value: 'normal', label: '无不适' }
        ]
    }
};

const recommendations = [
    {
        id: 'homecare',
        icon: '🏠',
        iconClass: 'icon-home',
        title: '继续居家维护',
        desc: '口腔卫生状况良好，继续保持日常口腔清洁习惯，按预约时间定期复查。'
    },
    {
        id: 'scaling',
        icon: '🦷',
        iconClass: 'icon-scaling',
        title: '安排龈下刮治评估',
        desc: '存在牙周袋及探诊出血，建议进行详细牙周检查，评估是否需要龈下刮治/根面平整。'
    },
    {
        id: 'return',
        icon: '📅',
        iconClass: 'icon-return',
        title: '提前复诊',
        desc: '当前状况需要密切关注，建议缩短复查间隔，加强专业维护及口腔卫生指导。'
    },
    {
        id: 'refer',
        icon: '🏥',
        iconClass: 'icon-refer',
        title: '转牙周治疗',
        desc: '牙周炎症状明显或种植体周病变，建议转牙周专科进行系统治疗。'
    }
];

const visitOptions = [
    { value: '1month', label: '1个月后' },
    { value: '3months', label: '3个月后' },
    { value: '6months', label: '6个月后' },
    { value: '12months', label: '1年后' },
    { value: 'custom', label: '自定义' }
];
