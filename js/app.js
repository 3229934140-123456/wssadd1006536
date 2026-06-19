class PeriodontalApp {
    constructor() {
        this.patients = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.selectedPatient = null;
        this.selectedPatientId = null;
        this.followupData = {};
        this.conclusionData = {};
        this.currentDoctor = null;
        this.historyFilter = 'all';
        this.aiRecommendation = null;
        this.aiApplied = false;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.initDoctorSelector();
        this.setupEventListeners();
        this.renderDoctorSelector();
        this.renderPatientList();
        this.updateFooterStats();
        this.setCurrentDate();
        this.updateNotificationCount();

        if (this.selectedPatientId) {
            this.selectPatient(this.selectedPatientId, true);
        }
    }

    loadFromStorage() {
        try {
            const storedPatients = localStorage.getItem(StorageKeys.PATIENTS);
            if (storedPatients) {
                this.patients = JSON.parse(storedPatients);
            } else {
                this.patients = JSON.parse(JSON.stringify(mockPatients));
                this.saveToStorage();
            }

            const storedDoctor = localStorage.getItem(StorageKeys.CURRENT_DOCTOR);
            if (storedDoctor) {
                this.currentDoctor = JSON.parse(storedDoctor);
            } else {
                this.currentDoctor = doctors[0];
            }

            const storedPatientId = localStorage.getItem(StorageKeys.CURRENT_PATIENT);
            if (storedPatientId) {
                this.selectedPatientId = storedPatientId;
            }
        } catch (e) {
            console.error('读取本地存储失败:', e);
            this.patients = JSON.parse(JSON.stringify(mockPatients));
            this.currentDoctor = doctors[0];
        }
    }

    saveToStorage() {
        try {
            const indicator = document.querySelector('.storage-indicator');
            if (indicator) {
                indicator.classList.add('saving');
                setTimeout(() => indicator.classList.remove('saving'), 800);
            }

            localStorage.setItem(StorageKeys.PATIENTS, JSON.stringify(this.patients));
            localStorage.setItem(StorageKeys.CURRENT_DOCTOR, JSON.stringify(this.currentDoctor));
            if (this.selectedPatientId) {
                localStorage.setItem(StorageKeys.CURRENT_PATIENT, this.selectedPatientId);
            }

            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = `数据已保存 · ${this.formatTime(new Date())}`;
            }
        } catch (e) {
            console.error('保存到本地存储失败:', e);
            this.showToast('error', '保存失败', '数据保存到本地存储时出错');
        }
    }

    initDoctorSelector() {
        this.currentDoctor = doctors[0];
    }

    renderDoctorSelector() {
        const selectEl = document.getElementById('doctorSelect');
        if (!selectEl) return;

        selectEl.innerHTML = doctors.map(d => `
            <option value="${d.id}" ${d.id === this.currentDoctor?.id ? 'selected' : ''}>
                ${d.name} (${d.role} · ${d.title})
            </option>
        `).join('');

        selectEl.onchange = (e) => {
            const doctor = doctors.find(d => d.id === e.target.value);
            if (doctor) {
                this.currentDoctor = doctor;
                this.saveToStorage();
                this.showToast('info', '已切换医生', `当前记录医生：${doctor.name}（${doctor.role}）`);
                if (this.selectedPatient) {
                    this.renderDetailPanel();
                    this.renderConclusionPanel();
                }
            }
        };
    }

    setupEventListeners() {
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderPatientList();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshList();
        });
    }

    setCurrentDate() {
        const now = new Date();
        const dateStr = this.formatDate(now);
        document.getElementById('currentDate').textContent = dateStr;
    }

    updateNotificationCount() {
        const count = this.patients.filter(p => 
            p.status === 'attention' || 
            (p.followupRecords && p.followupRecords.some(r => r.status === 'draft'))
        ).length;
        const badge = document.getElementById('notificationCount');
        if (badge) badge.textContent = count;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.classList.toggle('active', tag.dataset.filter === filter);
        });
        this.renderPatientList();
    }

    getFilteredPatients() {
        let filtered = this.patients;

        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(p => p.riskLevel === this.currentFilter);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(this.searchQuery) ||
                p.id.toLowerCase().includes(this.searchQuery)
            );
        }

        return filtered;
    }

    renderPatientList() {
        const listEl = document.getElementById('patientList');
        const patients = this.getFilteredPatients();

        if (patients.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <p class="empty-text">未找到匹配的患者</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = patients.map(patient => {
            const recordCount = patient.followupRecords?.length || 0;
            const hasDraft = patient.followupRecords?.some(r => r.status === 'draft');
            const isActive = this.selectedPatientId === patient.id;

            return `
                <div class="patient-card ${isActive ? 'active' : ''}" 
                     data-id="${patient.id}"
                     onclick="app.selectPatient('${patient.id}')">
                    <div class="patient-card-header">
                        <div>
                            <span class="patient-name">${patient.name}</span>
                            <span class="patient-age-gender">${patient.gender} · ${patient.age}岁</span>
                        </div>
                        <span class="status-dot status-${patient.status}"></span>
                    </div>
                    <div class="patient-card-meta">
                        <span class="risk-badge ${patient.riskLevel}">${patient.riskLabel}</span>
                        <span class="last-visit">上次: ${this.formatDate(patient.lastVisit)}</span>
                    </div>
                    ${recordCount > 0 ? `
                        <div class="patient-card-footer">
                            <span class="record-count">随访记录：<strong>${recordCount}</strong> 条</span>
                            ${hasDraft ? '<span class="continue-hint">有草稿</span>' : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    selectPatient(patientId, fromStorage = false) {
        this.selectedPatient = this.patients.find(p => p.id === patientId);
        this.selectedPatientId = patientId;
        this.aiRecommendation = null;
        this.aiApplied = false;

        const records = this.selectedPatient.followupRecords || [];
        const draftRecord = records.find(r => r.status === 'draft');

        if (draftRecord && !fromStorage) {
            this.followupData = { ...draftRecord.followupData };
            this.conclusionData = { ...draftRecord.conclusion };
            this.showToast('warning', '发现草稿', `已载入 ${this.formatDate(draftRecord.date)} ${draftRecord.doctor} 的未完成记录`);
        } else {
            this.followupData = {};
            this.conclusionData = {};
        }

        if (!fromStorage) {
            this.generateAIRecommendation();
        }

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    getLastSubmittedRecord(patient) {
        const p = patient || this.selectedPatient;
        const records = p?.followupRecords || [];
        const submitted = records.filter(r => r.status === 'submitted');
        return submitted.length > 0 ? submitted[submitted.length - 1] : null;
    }

    getAllSubmittedRecords(patient) {
        const p = patient || this.selectedPatient;
        const records = p?.followupRecords || [];
        return records.filter(r => r.status === 'submitted').sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }

    renderDetailPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('detailContent');

        document.getElementById('patientIdBadge').textContent = p.id;

        const plaqueClass = p.plaqueLevel === 'good' ? 'good' : p.plaqueLevel === 'moderate' ? 'moderate' : 'poor';
        const plaqueLabel = p.plaqueLevel === 'good' ? '良好' : p.plaqueLevel === 'moderate' ? '一般' : '较差';

        const lastRecord = this.getLastSubmittedRecord();
        const allRecords = this.getAllSubmittedRecords();

        contentEl.innerHTML = `
            <div class="detail-section">
                <div class="section-header">
                    <h3>基本信息</h3>
                    <span class="section-badge">${p.riskLabel}</span>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">患者姓名</span>
                        <span class="info-value">${p.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">性　　别</span>
                        <span class="info-value">${p.gender}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">年　　龄</span>
                        <span class="info-value">${p.age} 岁</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">负责医生</span>
                        <span class="info-value">
                            ${p.doctor}
                            <span class="record-doctor-tag ${p.doctor === this.currentDoctor?.name ? 'current-doctor' : ''}">
                                原医生
                            </span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">上次洁治</span>
                        <span class="info-value highlight">${this.formatDate(p.lastCleaning)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">距今天数</span>
                        <span class="info-value">${this.daysSince(p.lastCleaning)} 天</span>
                    </div>
                </div>
            </div>

            ${lastRecord ? this.renderLastJudgmentBox(lastRecord) : ''}

            <div class="detail-section">
                <div class="section-header">
                    <h3>菌斑控制评价</h3>
                    <span class="section-badge">${plaqueLabel}</span>
                </div>
                <div class="plaque-scale">
                    <div class="plaque-bar">
                        <div class="plaque-fill ${plaqueClass}" style="width: ${p.plaqueControl}%"></div>
                    </div>
                    <span class="plaque-text">${p.plaqueControl}%</span>
                </div>
            </div>

            <div class="detail-section">
                <div class="section-header">
                    <h3>探诊出血备注</h3>
                </div>
                <div class="bleeding-status">
                    <div class="bleeding-icon ${plaqueClass}">
                        ${p.status === 'good' ? '✓' : p.status === 'watch' ? '!' : '⚠'}
                    </div>
                    <div class="bleeding-detail">
                        <div class="bleeding-label">${p.bleedingSites}</div>
                        <div class="bleeding-note">${p.bleedingNote}</div>
                    </div>
                </div>
            </div>

            ${allRecords.length > 0 ? this.renderComparisonSection(allRecords) : ''}

            <div class="detail-section">
                <div class="section-header">
                    <h3>口腔照片</h3>
                    <span class="section-badge">${p.photos} 张</span>
                </div>
                <div class="photo-gallery">
                    ${Array(p.photos).fill(0).map((_, i) => `
                        <div class="photo-item">
                            <div class="photo-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <span>口内照${i + 1}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="detail-section">
                <div class="section-header">
                    <h3>上次医嘱</h3>
                </div>
                <div class="prescription-box">
                    <strong>医嘱：</strong>${p.prescription}
                </div>
            </div>

            ${this.renderHistorySection(p)}

            <div class="detail-section">
                <div class="section-header">
                    <h3>本次随访记录</h3>
                    <div>
                        <span class="record-doctor-tag current-doctor">
                            记录人：${this.currentDoctor?.name}
                        </span>
                        <span class="section-badge" style="margin-left: 6px;">结构化填写</span>
                    </div>
                </div>
                <div class="followup-form" id="followupForm">
                    ${this.renderFollowupQuestion('brushingMethod', followupQuestions.brushingMethod)}
                    ${this.renderFollowupQuestion('brushingFrequency', followupQuestions.brushingFrequency)}
                    ${this.renderFollowupQuestion('flossUse', followupQuestions.flossUse)}
                    ${this.renderFollowupQuestion('irrigatorUse', followupQuestions.irrigatorUse)}
                    ${this.renderFollowupQuestion('bleedingChange', followupQuestions.bleedingChange)}
                    ${this.renderFollowupQuestion('gumCondition', followupQuestions.gumCondition)}
                    
                    <div class="form-group">
                        <label class="form-label">补充说明</label>
                        <textarea class="textarea-input" 
                                  placeholder="请输入随访中的其他观察或患者反馈..."
                                  oninput="app.updateFollowupNote(this.value)"
                                  id="followupNote">${this.followupData.note || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    renderLastJudgmentBox(lastRecord) {
        const rec = recommendations.find(r => r.id === lastRecord.conclusion?.recommendation);
        const visit = visitOptions.find(v => v.value === lastRecord.conclusion?.visitInterval);
        return `
            <div class="last-judgment-box">
                <div class="last-judgment-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                    </svg>
                    上次医生判断
                    <span class="record-doctor-tag ${lastRecord.doctor === this.currentDoctor?.name ? 'current-doctor' : ''}" style="margin-left: auto;">
                        ${lastRecord.doctor} · ${this.formatDate(lastRecord.date)}
                    </span>
                </div>
                <div class="last-judgment-content">
                    <div><strong>建议：</strong>${rec?.title || '未选择'}</div>
                    ${visit ? `<div style="margin-top: 4px;"><strong>复诊：</strong>${visit.label}</div>` : ''}
                    ${lastRecord.conclusion?.note ? `<div style="margin-top: 4px;"><strong>备注：</strong>${lastRecord.conclusion.note}</div>` : ''}
                </div>
                <div class="last-judgment-meta">
                    您可以基于此判断继续调整本次结论
                </div>
            </div>
        `;
    }

    renderComparisonSection(allRecords) {
        const lastRecord = allRecords[0];
        const prevRecord = allRecords.length > 1 ? allRecords[1] : null;
        
        const comparisonItems = [
            {
                key: 'brushingMethod',
                label: '刷牙方式',
                options: followupQuestions.brushingMethod.options,
                compare: true
            },
            {
                key: 'flossUse',
                label: '牙线/牙缝刷',
                options: followupQuestions.flossUse.options,
                compare: true
            },
            {
                key: 'irrigatorUse',
                label: '冲牙器使用',
                options: followupQuestions.irrigatorUse.options,
                compare: true
            },
            {
                key: 'bleedingChange',
                label: '出血变化',
                options: followupQuestions.bleedingChange.options,
                compare: prevRecord?.followupData?.bleedingChange
            },
            {
                key: 'gumCondition',
                label: '牙龈状况',
                options: followupQuestions.gumCondition.options,
                multi: true,
                compare: true
            }
        ];

        const getOptionLabel = (options, value) => {
            if (!value) return '—';
            const opt = options.find(o => o.value === value);
            return opt ? opt.label : '—';
        };

        const getMultiLabels = (options, values) => {
            if (!values || values.length === 0) return '—';
            return values.map(v => getOptionLabel(options, v)).join('、');
        };

        const getChangeBadge = (curVal, prevVal, isImproveBetter = true, isMulti = false) => {
            if (!prevVal || prevVal === '—') return '';
            
            if (isMulti) {
                const curArr = Array.isArray(curVal) ? curVal : [];
                const prevArr = Array.isArray(prevVal) ? prevVal : [];
                const hasNormalCur = curArr.includes('normal');
                const hasNormalPrev = prevArr.includes('normal');
                if (hasNormalCur && !hasNormalPrev) return '<span class="change-badge up">↑好转</span>';
                if (!hasNormalCur && hasNormalPrev) return '<span class="change-badge down">↓变化</span>';
                const badOptions = ['pus', 'loose', 'bleeding', 'red'];
                const curBad = curArr.filter(v => badOptions.includes(v)).length;
                const prevBad = prevArr.filter(v => badOptions.includes(v)).length;
                if (curBad < prevBad) return '<span class="change-badge up">↑减少</span>';
                if (curBad > prevBad) return '<span class="change-badge down">↓增加</span>';
                return '<span class="change-badge same">=相同</span>';
            }

            const improveOrder = { improve: 4, slight: 3, same: 2, worse: 1 };
            const usageOrder = { daily: 4, weekly: 3, rarely: 2, never: 1, twice: 3, once: 2, irregular: 1 };
            const order = improveOrder[curVal] !== undefined ? improveOrder : usageOrder;
            
            if (order[curVal] !== undefined && order[prevVal] !== undefined) {
                const diff = order[curVal] - order[prevVal];
                if (diff > 0) return `<span class="change-badge up">↑${isImproveBetter ? '进步' : '变化'}</span>`;
                if (diff < 0) return `<span class="change-badge down">↓${isImproveBetter ? '退步' : '变化'}</span>`;
            }
            return '<span class="change-badge same">=相同</span>';
        };

        return `
            <div class="detail-section comparison-section">
                <div class="section-header section-header-with-actions">
                    <h3>维护记录对比</h3>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="section-badge">上次 vs 本次(预填)</span>
                    </div>
                </div>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th style="width:110px;">项目</th>
                            <th>${this.formatDate(lastRecord.date)} · ${lastRecord.doctor}</th>
                            <th class="col-current">本次填写</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparisonItems.map(item => {
                            const isMulti = item.multi;
                            const lastVal = isMulti 
                                ? getMultiLabels(item.options, lastRecord.followupData?.[item.key])
                                : getOptionLabel(item.options, lastRecord.followupData?.[item.key]);
                            const curVal = isMulti
                                ? getMultiLabels(item.options, this.followupData[item.key] || [])
                                : getOptionLabel(item.options, this.followupData[item.key]);
                            const rawLastVal = lastRecord.followupData?.[item.key];
                            const rawCurVal = this.followupData[item.key];
                            const prevPrevVal = prevRecord?.followupData?.[item.key];

                            let changeBadge = '';
                            if (item.key === 'bleedingChange') {
                                changeBadge = getChangeBadge(rawCurVal, prevPrevVal, true, false);
                            } else {
                                changeBadge = getChangeBadge(rawCurVal, rawLastVal, true, isMulti);
                            }

                            return `
                                <tr>
                                    <td class="comparison-label">${item.label}</td>
                                    <td class="comparison-value">${lastVal}</td>
                                    <td class="comparison-value col-current">
                                        ${curVal || '<span style="color: var(--text-tertiary);">待填写</span>'}
                                        ${changeBadge}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderHistorySection(p) {
        const allHistory = [
            ...(p.history || []).map(h => ({ ...h, type: 'visit' })),
            ...(p.followupRecords || []).map(r => ({
                type: r.status,
                date: r.date,
                doctor: r.doctor,
                event: r.status === 'draft' ? '随访草稿' : '随访记录',
                note: r.conclusion?.note || this.getFollowupSummary(r),
                recordId: r.id,
                fullRecord: r
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return `
            <div class="detail-section">
                <div class="section-header section-header-with-actions">
                    <h3>历史记录</h3>
                    <div class="history-filter">
                        <button class="history-filter-btn active" onclick="app.setHistoryFilter('all', this)">全部</button>
                        <button class="history-filter-btn" onclick="app.setHistoryFilter('submitted', this)">随访</button>
                        <button class="history-filter-btn" onclick="app.setHistoryFilter('visit', this)">就诊</button>
                    </div>
                </div>
                <div class="timeline">
                    ${allHistory
                        .filter(h => this.historyFilter === 'all' || h.type === this.historyFilter || (this.historyFilter === 'submitted' && h.type === 'draft'))
                        .map(h => `
                        <div class="timeline-item">
                            <div class="timeline-dot" style="${h.type === 'draft' ? 'background: var(--warning-color); border-color: var(--warning-color);' : ''}"></div>
                            <div class="timeline-date">
                                ${this.formatDate(h.date)}
                                ${h.type === 'draft' ? '<span class="followup-record-status draft" style="margin-left:6px;">草稿</span>' : ''}
                                ${h.type === 'submitted' ? '<span class="followup-record-status submitted" style="margin-left:6px;">已提交</span>' : ''}
                            </div>
                            <div class="timeline-content">${h.event}</div>
                            <div class="timeline-doctor">
                                <span class="record-doctor-tag ${h.doctor === this.currentDoctor?.name ? 'current-doctor' : ''}">
                                    ${h.doctor}
                                </span>
                                · ${h.note}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setHistoryFilter(filter, btn) {
        this.historyFilter = filter;
        document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        this.renderDetailPanel();
    }

    getFollowupSummary(record) {
        const parts = [];
        const fd = record.followupData || {};
        if (fd.brushingMethod) {
            const opt = followupQuestions.brushingMethod.options.find(o => o.value === fd.brushingMethod);
            if (opt) parts.push(`刷牙：${opt.label}`);
        }
        if (fd.flossUse) {
            const opt = followupQuestions.flossUse.options.find(o => o.value === fd.flossUse);
            if (opt) parts.push(`牙线：${opt.label}`);
        }
        const rec = recommendations.find(r => r.id === record.conclusion?.recommendation);
        if (rec) parts.push(`结论：${rec.title}`);
        return parts.join(' | ') || '—';
    }

    renderFollowupQuestion(key, question) {
        const selected = this.followupData[key] || (question.multi ? [] : '');
        const isMulti = question.multi;

        return `
            <div class="form-group">
                <label class="form-label">${question.label}</label>
                <div class="${isMulti ? 'checkbox-group' : 'radio-group'}">
                    ${question.options.map(opt => {
                        const isSelected = isMulti 
                            ? selected.includes(opt.value)
                            : selected === opt.value;
                        return `
                            <label class="${isMulti ? 'checkbox-option' : 'radio-option'} ${isSelected ? 'selected' : ''}">
                                <input type="${isMulti ? 'checkbox' : 'radio'}" 
                                       name="${key}" 
                                       value="${opt.value}"
                                       ${isSelected ? 'checked' : ''}
                                       onchange="app.updateFollowup('${key}', '${opt.value}', ${isMulti})">
                                ${opt.label}
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    updateFollowup(key, value, isMulti) {
        if (isMulti) {
            if (!this.followupData[key]) {
                this.followupData[key] = [];
            }
            const idx = this.followupData[key].indexOf(value);
            if (idx > -1) {
                this.followupData[key].splice(idx, 1);
            } else {
                this.followupData[key].push(value);
            }
        } else {
            this.followupData[key] = value;
        }

        this.generateAIRecommendation();
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    updateFollowupNote(value) {
        this.followupData.note = value;
    }

    generateAIRecommendation() {
        if (!this.selectedPatient) {
            this.aiRecommendation = null;
            return;
        }

        const p = this.selectedPatient;
        const fd = this.followupData;
        let recId = 'homecare';
        let visitInterval = '6months';
        let reasons = [];
        let confidence = 0;

        if (p.riskLevel === 'periodontitis') {
            confidence += 25;
            recId = 'scaling';
            visitInterval = '1month';
            reasons.push(`风险等级为<strong>${p.riskLabel}</strong>`);
        }
        if (p.riskLevel === 'implant' && p.status === 'attention') {
            confidence += 30;
            recId = 'refer';
            visitInterval = '1month';
            reasons.push(`<strong>种植体周病变</strong>需专科治疗`);
        }
        if (p.riskLevel === 'implant') {
            confidence += 15;
            recId = recId === 'homecare' ? 'return' : recId;
            visitInterval = '3months';
            reasons.push(`<strong>种植体维护</strong>建议缩短间隔`);
        }
        if (p.riskLevel === 'ortho') {
            confidence += 10;
            visitInterval = '3months';
            reasons.push(`<strong>正畸期间</strong>需加强清洁`);
        }
        if (p.status === 'attention') {
            confidence += 20;
            if (p.riskLevel === 'periodontitis' || p.riskLevel === 'implant') {
                recId = 'refer';
            } else {
                recId = 'scaling';
            }
            visitInterval = '1month';
            reasons.push(`当前状态<strong>需重点关注</strong>`);
        }

        if (fd.bleedingChange === 'worse') {
            confidence += 20;
            recId = 'scaling';
            visitInterval = '1month';
            reasons.push(`患者反馈<strong>出血加重</strong>`);
        }
        if (fd.bleedingChange === 'same' && p.status !== 'good') {
            confidence += 10;
            if (recId === 'homecare') recId = 'return';
            reasons.push(`出血情况<strong>无改善</strong>`);
        }
        if (fd.bleedingChange === 'improve' || fd.bleedingChange === 'slight') {
            confidence += 10;
            if (p.riskLevel === 'gingivitis') {
                recId = 'homecare';
            }
            reasons.push(`患者反馈<strong>出血好转</strong>，治疗有效`);
        }

        const gumCond = fd.gumCondition || [];
        if (gumCond.includes('pus')) {
            confidence += 25;
            recId = 'refer';
            visitInterval = '1month';
            reasons.push(`出现<strong>溢脓</strong>症状`);
        }
        if (gumCond.includes('loose')) {
            confidence += 20;
            recId = 'scaling';
            if (p.riskLevel === 'periodontitis') recId = 'refer';
            reasons.push(`存在<strong>牙齿松动</strong>`);
        }
        if (gumCond.includes('bleeding') || gumCond.includes('red')) {
            confidence += 10;
            if (recId === 'homecare') recId = 'return';
            reasons.push(`仍有<strong>红肿/出血</strong>`);
        }
        if (gumCond.includes('normal') && gumCond.length === 1) {
            confidence += 15;
            if (p.riskLevel === 'gingivitis' && p.status === 'good') {
                recId = 'homecare';
            }
            reasons.push(`患者自述<strong>无不适</strong>`);
        }

        if (fd.flossUse === 'never' || fd.flossUse === 'rarely') {
            confidence += 5;
            reasons.push(`牙线使用<strong>不足</strong>`);
        }
        if (fd.brushingFrequency === 'once' || fd.brushingFrequency === 'irregular') {
            confidence += 5;
            reasons.push(`刷牙频率<strong>不够</strong>`);
        }
        if (fd.brushingMethod === 'horizontal' || fd.brushingMethod === 'unclear') {
            confidence += 5;
            reasons.push(`刷牙方式<strong>需改进</strong>`);
        }

        if (Object.keys(fd).length === 0 || 
            (Object.keys(fd).length === 1 && fd.note)) {
            this.aiRecommendation = null;
            return;
        }

        confidence = Math.min(confidence, 100);
        const rec = recommendations.find(r => r.id === recId);

        this.aiRecommendation = {
            recommendation: recId,
            visitInterval: visitInterval,
            confidence: confidence,
            reasons: reasons,
            title: rec?.title || '继续居家维护'
        };

        if (!this.aiApplied && confidence >= 40) {
            this.conclusionData.recommendation = recId;
            if (!this.conclusionData.visitInterval) {
                this.conclusionData.visitInterval = visitInterval;
            }
            this.aiApplied = true;
        }
    }

    renderConclusionPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('conclusionContent');
        const statusEl = document.getElementById('statusIndicator');

        const hasConclusion = this.conclusionData.recommendation || this.conclusionData.visitInterval;
        const records = p.followupRecords || [];
        const submittedCount = records.filter(r => r.status === 'submitted').length;

        if (hasConclusion) {
            statusEl.textContent = '已填写';
            statusEl.className = 'status-indicator status-completed';
        } else {
            statusEl.textContent = '待填写';
            statusEl.className = 'status-indicator status-pending';
        }

        const aiHint = this.aiRecommendation ? `
            <div class="ai-hint-box">
                <div class="ai-hint-header">
                    <span class="ai-tag">AI 推荐</span>
                    <span class="ai-hint-title">基于风险等级和随访回答的初步建议</span>
                    <span style="margin-left:auto; font-size:11px; color: var(--text-tertiary);">
                        置信度 ${this.aiRecommendation.confidence}%
                    </span>
                </div>
                <div class="ai-hint-content">
                    <div>推荐方案：<strong>${this.aiRecommendation.title}</strong></div>
                    ${this.aiRecommendation.reasons.length > 0 ? `
                        <div style="margin-top:6px;">
                            ${this.aiRecommendation.reasons.map(r => `• ${r}`).join('<br>')}
                        </div>
                    ` : ''}
                    <button class="auto-apply-btn" style="margin-top:10px;" 
                            onclick="app.applyAIRecommendation()">
                        使用此推荐
                    </button>
                </div>
            </div>
        ` : Object.keys(this.followupData).length > 1 ? `
            <div class="ai-hint-box" style="opacity:0.7;">
                <div class="ai-hint-header">
                    <span class="ai-tag" style="background: var(--bg-tertiary); color: var(--text-secondary);">AI</span>
                    <span class="ai-hint-title" style="color: var(--text-secondary);">填写更多随访项以获得推荐</span>
                </div>
            </div>
        ` : '';

        contentEl.innerHTML = `
            ${aiHint}

            <div class="detail-section">
                <div class="section-header">
                    <h3>下一步建议</h3>
                    <span class="section-badge">可手动调整</span>
                </div>
                <div class="recommendation-list">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item ${this.conclusionData.recommendation === rec.id ? 'selected' : ''}"
                             onclick="app.selectRecommendation('${rec.id}')">
                            <div class="recommendation-header">
                                <div class="recommendation-icon ${rec.iconClass}">${rec.icon}</div>
                                <div class="recommendation-title">${rec.title}</div>
                                ${this.aiRecommendation?.recommendation === rec.id ? 
                                    '<span style="margin-left:auto; font-size:10px; padding:2px 6px; background: rgba(74,144,164,0.12); color: var(--secondary-color); border-radius:4px;">AI推荐</span>' 
                                    : ''}
                            </div>
                            <div class="recommendation-desc">${rec.desc}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="next-visit-section">
                <div class="next-visit-label">下次复诊时间</div>
                <div class="next-visit-options">
                    ${visitOptions.map(opt => `
                        <button class="visit-option ${this.conclusionData.visitInterval === opt.value ? 'selected' : ''}"
                                onclick="app.selectVisitInterval('${opt.value}')">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="conclusion-notes">
                <div class="form-group">
                    <label class="form-label">医生备注</label>
                    <textarea class="textarea-input" 
                              placeholder="请输入复查结论的详细说明、注意事项等..."
                              oninput="app.updateConclusionNote(this.value)"
                              id="conclusionNote">${this.conclusionData.note || ''}</textarea>
                </div>
            </div>

            <div class="doctor-signature">
                <div class="signature-info">
                    <div>
                        接诊医生：<strong>${this.currentDoctor?.name}</strong>
                        <span class="record-doctor-tag current-doctor" style="margin-left:6px;">
                            ${this.currentDoctor?.role}
                        </span>
                    </div>
                    <div>记录日期：${this.formatDate(new Date())}</div>
                    ${submittedCount > 0 ? `
                        <div style="margin-top:4px;">既往随访：${submittedCount} 条记录</div>
                    ` : ''}
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="app.saveDraft()">保存草稿</button>
                <button class="btn btn-primary" onclick="app.submitConclusion()">提交结论</button>
            </div>
        `;
    }

    applyAIRecommendation() {
        if (!this.aiRecommendation) return;
        this.conclusionData.recommendation = this.aiRecommendation.recommendation;
        this.conclusionData.visitInterval = this.aiRecommendation.visitInterval;
        this.showToast('success', '已应用AI推荐', `建议：${this.aiRecommendation.title}`);
        this.renderConclusionPanel();
    }

    selectRecommendation(id) {
        this.conclusionData.recommendation = id;
        this.renderConclusionPanel();
    }

    selectVisitInterval(value) {
        this.conclusionData.visitInterval = value;
        this.renderConclusionPanel();
    }

    updateConclusionNote(value) {
        this.conclusionData.note = value;
    }

    saveDraft() {
        if (!this.selectedPatient) return;

        const hasContent = Object.keys(this.followupData).length > 0 || 
                          Object.keys(this.conclusionData).length > 0;
        if (!hasContent) {
            this.showToast('warning', '无内容可保存', '请先填写随访记录或复查结论');
            return;
        }

        const pIndex = this.patients.findIndex(p => p.id === this.selectedPatient.id);
        if (pIndex === -1) return;

        if (!this.patients[pIndex].followupRecords) {
            this.patients[pIndex].followupRecords = [];
        }

        const draftIdx = this.patients[pIndex].followupRecords.findIndex(r => r.status === 'draft');
        const draftRecord = {
            id: 'FU' + Date.now(),
            date: this.formatDate(new Date()),
            doctor: this.currentDoctor?.name || '未知医生',
            doctorRole: this.currentDoctor?.role || '',
            followupData: { ...this.followupData },
            conclusion: { ...this.conclusionData },
            status: 'draft',
            updatedAt: new Date().toISOString()
        };

        if (draftIdx > -1) {
            draftRecord.id = this.patients[pIndex].followupRecords[draftIdx].id;
            this.patients[pIndex].followupRecords[draftIdx] = draftRecord;
        } else {
            this.patients[pIndex].followupRecords.push(draftRecord);
        }

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
        this.showToast('success', '草稿已保存', `记录人：${this.currentDoctor?.name}，刷新后仍可继续编辑`);
    }

    submitConclusion() {
        if (!this.selectedPatient) {
            alert('请先选择患者');
            return;
        }
        if (!this.conclusionData.recommendation) {
            alert('请选择下一步建议');
            return;
        }
        if (!this.conclusionData.visitInterval) {
            alert('请选择下次复诊时间');
            return;
        }

        const pIndex = this.patients.findIndex(p => p.id === this.selectedPatient.id);
        if (pIndex === -1) return;

        if (!this.patients[pIndex].followupRecords) {
            this.patients[pIndex].followupRecords = [];
        }

        const draftIdx = this.patients[pIndex].followupRecords.findIndex(r => r.status === 'draft');
        const finalRecord = {
            id: draftIdx > -1 ? this.patients[pIndex].followupRecords[draftIdx].id : 'FU' + Date.now(),
            date: this.formatDate(new Date()),
            doctor: this.currentDoctor?.name || '未知医生',
            doctorRole: this.currentDoctor?.role || '',
            followupData: { ...this.followupData },
            conclusion: { ...this.conclusionData },
            status: 'submitted',
            submittedAt: new Date().toISOString()
        };

        if (draftIdx > -1) {
            this.patients[pIndex].followupRecords[draftIdx] = finalRecord;
        } else {
            this.patients[pIndex].followupRecords.push(finalRecord);
        }

        this.patients[pIndex].lastVisit = finalRecord.date;
        this.patients[pIndex].history = this.patients[pIndex].history || [];

        const rec = recommendations.find(r => r.id === finalRecord.conclusion.recommendation);
        const visit = visitOptions.find(v => v.value === finalRecord.conclusion.visitInterval);
        
        this.patients[pIndex].history.unshift({
            date: finalRecord.date,
            event: `${rec?.title || '随访'} · 复诊${visit?.label || ''}`,
            doctor: finalRecord.doctor,
            note: finalRecord.conclusion.note || this.getFollowupSummary(finalRecord)
        });

        this.saveToStorage();
        this.updateNotificationCount();
        this.updateFooterStats();

        const statusEl = document.getElementById('statusIndicator');
        statusEl.textContent = '已提交';
        statusEl.className = 'status-indicator status-completed';

        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();

        this.showToast(
            'success', 
            '复查结论已提交', 
            `${this.currentDoctor?.name} · ${this.selectedPatient.name}\n建议：${rec?.title} · 复诊：${visit?.label}`
        );

        this.followupData = {};
        this.conclusionData = {};
        this.aiRecommendation = null;
        this.aiApplied = false;
    }

    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '💬'}</span>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message.replace(/\n/g, '<br>')}</div>
            </div>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3200);
    }

    refreshList() {
        this.loadFromStorage();
        this.renderPatientList();
        this.updateFooterStats();
        this.showToast('info', '数据已刷新', '已从本地存储重新加载');
    }

    updateFooterStats() {
        const today = this.formatDate(new Date());
        const todayPatients = this.patients.filter(p => {
            const records = p.followupRecords || [];
            return records.some(r => r.date === today && r.status === 'submitted') 
                   || p.lastVisit === today;
        }).length;

        const pendingPatients = this.patients.filter(p => 
            p.status === 'watch' || p.status === 'attention'
        ).length;

        const totalRecords = this.patients.reduce((sum, p) => {
            return sum + ((p.followupRecords || []).filter(r => r.status === 'submitted').length);
        }, 0);

        document.getElementById('todayCount').textContent = todayPatients;
        document.getElementById('pendingCount').textContent = pendingPatients;
        document.getElementById('totalRecords').textContent = totalRecords;
    }

    formatDate(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
    }

    formatTime(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return String(d.getHours()).padStart(2, '0') + ':' + 
            String(d.getMinutes()).padStart(2, '0');
    }

    daysSince(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
}

const app = new PeriodontalApp();
