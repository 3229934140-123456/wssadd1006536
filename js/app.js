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
        this.expandedRecordIds = new Set();
        this.handoffChoice = null;
        this.editingDraftId = null;
        this.init();
    }

    init() {
        this.loadFromStorage();
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
                localStorage.setItem(StorageKeys.CURRENT_DOCTOR, JSON.stringify(this.currentDoctor));
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

                if (this.selectedPatient) {
                    this.selectPatient(this.selectedPatientId, false);
                } else {
                    this.showToast('info', '已切换医生', `当前记录医生：${doctor.name}（${doctor.role}）`);
                }
                this.updateNotificationCount();
                this.renderPatientList();
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
        let count = this.patients.filter(p => p.status === 'attention').length;
        let draftCount = 0;
        this.patients.forEach(p => {
            if (p.followupRecords) {
                p.followupRecords.forEach(r => {
                    if (r.status === 'draft' && r.doctor === this.currentDoctor?.name) {
                        draftCount++;
                    }
                });
            }
        });
        const badge = document.getElementById('notificationCount');
        if (badge) badge.textContent = count + draftCount;
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
            const submittedCount = (patient.followupRecords || []).filter(r => r.status === 'submitted').length;
            const allDrafts = (patient.followupRecords || []).filter(r => r.status === 'draft');
            const myDraft = allDrafts.find(r => r.doctor === this.currentDoctor?.name);
            const otherDrafts = allDrafts.filter(r => r.doctor !== this.currentDoctor?.name);
            const hasOtherDraft = otherDrafts.length > 0;
            const isActive = this.selectedPatientId === patient.id;

            let draftHint = '';
            if (myDraft && hasOtherDraft) {
                draftHint = `<span class="continue-hint">我的草稿 +${otherDrafts.length}</span>`;
            } else if (myDraft) {
                draftHint = `<span class="continue-hint">我的草稿</span>`;
            } else if (hasOtherDraft) {
                draftHint = `<span class="continue-hint">${otherDrafts[0].doctor}的草稿</span>`;
            }

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
                    ${(submittedCount > 0 || allDrafts.length > 0) ? `
                        <div class="patient-card-footer">
                            <span class="record-count">随访：<strong>${submittedCount}</strong> 条</span>
                            ${draftHint}
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
        this.handoffChoice = null;
        this.editingDraftId = null;
        this.expandedRecordIds = new Set();

        const records = this.selectedPatient.followupRecords || [];
        const myDraft = records.find(r => r.status === 'draft' && r.doctor === this.currentDoctor?.name);
        const otherDrafts = records.filter(r => r.status === 'draft' && r.doctor !== this.currentDoctor?.name);
        const otherDraft = otherDrafts.length > 0 ? otherDrafts.sort((a,b) => new Date(b.date) - new Date(a.date))[0] : null;
        const lastSubmitted = this.getLastSubmittedRecord();

        if (myDraft) {
            this.handoffChoice = 'continue';
            this.editingDraftId = myDraft.id;
            this.followupData = { ...myDraft.followupData };
            this.conclusionData = { ...myDraft.conclusion };
            if (!fromStorage) {
                this.showToast('info', '载入草稿', `已载入您 ${this.formatDate(myDraft.date)} 的未完成记录`);
            }
        } else if (otherDraft) {
            this.handoffChoice = 'ask';
            this.followupData = {};
            this.conclusionData = {};
            if (!fromStorage) {
                this.showToast(
                    'warning',
                    `发现 ${otherDraft.doctor} 的草稿`,
                    '可选择继续编辑该草稿，或放弃新建一条记录'
                );
            }
        } else {
            this.followupData = {};
            this.conclusionData = {};
            if (lastSubmitted && !fromStorage) {
                this.showToast(
                    'info',
                    `上次记录 · ${lastSubmitted.doctor}`,
                    `${this.formatDate(lastSubmitted.date)} · 建议：${this.getRecommendationTitle(lastSubmitted.conclusion?.recommendation)}`
                );
            }
        }

        this.generateAIRecommendation();

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    handleHandoffChoice(choice) {
        this.handoffChoice = choice;
        const records = this.selectedPatient.followupRecords || [];
        const otherDrafts = records.filter(r => r.status === 'draft' && r.doctor !== this.currentDoctor?.name);
        const latestOtherDraft = otherDrafts.length > 0
            ? otherDrafts.sort((a,b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date))[0]
            : null;

        if (choice === 'continue' && latestOtherDraft) {
            this.editingDraftId = latestOtherDraft.id;
            this.followupData = { ...latestOtherDraft.followupData };
            this.conclusionData = { ...latestOtherDraft.conclusion };
            this.showToast('info', '继续编辑草稿', `草稿由 ${latestOtherDraft.doctor} 创建`);
        } else {
            this.editingDraftId = null;
            this.followupData = {};
            this.conclusionData = {};
            this.showToast('info', '新建记录', '已开始一条全新的随访记录');
        }

        this.generateAIRecommendation();
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    discardDraft() {
        if (!this.selectedPatient) return;
        const pIndex = this.patients.findIndex(p => p.id === this.selectedPatient.id);
        if (pIndex === -1) return;

        if (this.editingDraftId) {
            this.patients[pIndex].followupRecords = (this.patients[pIndex].followupRecords || [])
                .filter(r => r.id !== this.editingDraftId);
        }

        this.followupData = {};
        this.conclusionData = {};
        this.editingDraftId = null;
        this.handoffChoice = null;
        this.aiRecommendation = null;
        this.aiApplied = false;

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
        this.showToast('success', '草稿已删除', '已开始一条全新的随访记录');
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
            new Date(a.date) - new Date(b.date)
        );
    }

    getAllRecordsChronologically(patient) {
        const p = patient || this.selectedPatient;
        const records = p?.followupRecords || [];
        return [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    getRecommendationTitle(recId) {
        if (!recId) return '未选择';
        const rec = recommendations.find(r => r.id === recId);
        return rec ? rec.title : '未选择';
    }

    getOptionLabel(questionKey, value) {
        const q = followupQuestions[questionKey];
        if (!q || !value) return '—';
        const opt = q.options.find(o => o.value === value);
        return opt ? opt.label : '—';
    }

    getMultiOptionLabels(questionKey, values) {
        const q = followupQuestions[questionKey];
        if (!q || !values || values.length === 0) return '—';
        return values.map(v => this.getOptionLabel(questionKey, v)).join('、');
    }

    renderDetailPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('detailContent');
        document.getElementById('patientIdBadge').textContent = p.id;

        const plaqueClass = p.plaqueLevel === 'good' ? 'good' : p.plaqueLevel === 'moderate' ? 'moderate' : 'poor';
        const plaqueLabel = p.plaqueLevel === 'good' ? '良好' : p.plaqueLevel === 'moderate' ? '一般' : '较差';
        const lastRecord = this.getLastSubmittedRecord();
        const allSubmitted = this.getAllSubmittedRecords();
        const allRecordsChrono = this.getAllRecordsChronologically();
        const allDrafts = (p.followupRecords || []).filter(r => r.status === 'draft');
        const otherDrafts = allDrafts.filter(r => r.doctor !== this.currentDoctor?.name);
        const latestOtherDraft = otherDrafts.length > 0
            ? otherDrafts.sort((a,b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date))[0]
            : null;
        const editingDraft = this.editingDraftId
            ? (p.followupRecords || []).find(r => r.id === this.editingDraftId)
            : null;

        let handoffBanner = '';
        if (this.handoffChoice === 'ask' && latestOtherDraft) {
            handoffBanner = `
                <div class="handoff-banner">
                    <div class="handoff-title">
                        🤝 团队交接：发现 ${latestOtherDraft.doctor} 的未完成草稿
                    </div>
                    <div class="handoff-content">
                        该患者有 <strong>${this.formatDate(latestOtherDraft.date)}</strong> 由 <strong>${latestOtherDraft.doctor}</strong> 创建的随访草稿。
                        <br>您可以选择继续编辑该草稿，或放弃并开始一条全新的记录。
                    </div>
                    <div class="handoff-actions">
                        <button class="handoff-btn handoff-continue" onclick="app.handleHandoffChoice('continue')">
                            ✏️ 继续编辑该草稿
                        </button>
                        <button class="handoff-btn handoff-new" onclick="app.handleHandoffChoice('new')">
                            ➕ 放弃草稿，新建记录
                        </button>
                    </div>
                </div>
            `;
        }

        let draftBanner = '';
        if (this.editingDraftId && editingDraft && this.handoffChoice !== 'ask') {
            draftBanner = `
                <div class="draft-edit-banner">
                    <span>
                        <strong>✏️ 正在编辑草稿</strong> · 
                        ${editingDraft.doctor} · ${this.formatDate(editingDraft.date)}
                        ${editingDraft.doctor !== this.currentDoctor?.name ? 
                            ' <span class="continue-hint">跨医生续写</span>' : 
                            '<span class="new-record-badge">我的草稿</span>'}
                    </span>
                    <button class="draft-discard-btn" onclick="app.discardDraft()">放弃草稿</button>
                </div>
            `;
        }

        contentEl.innerHTML = `
            ${handoffBanner}
            ${draftBanner}

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

            ${allRecordsChrono.length >= 1 ? this.renderTrendView(allRecordsChrono) : ''}

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

            ${allSubmitted.length > 0 ? this.renderComparisonSection(allSubmitted) : ''}

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

            ${this.handoffChoice !== 'ask' ? `
            <div class="detail-section">
                <div class="section-header">
                    <h3>本次随访记录</h3>
                    <div>
                        <span class="record-doctor-tag current-doctor">
                            记录人：${this.currentDoctor?.name}
                        </span>
                        ${this.editingDraftId ? '<span class="continue-hint">续写草稿</span>' : '<span class="new-record-badge">新记录</span>'}
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
            ` : ''}
        `;
    }

    renderTrendView(recordsChrono) {
        const submittedRecords = recordsChrono.filter(r => r.status === 'submitted');
        if (submittedRecords.length === 0) return '';

        const latest = submittedRecords[submittedRecords.length - 1];
        const earliest = submittedRecords[0];

        const tracks = [
            {
                key: 'bleedingChange',
                label: '出血变化趋势',
                goodValues: ['improve', 'slight'],
                badValues: ['worse'],
                neutralValues: ['same']
            },
            {
                key: 'flossUse',
                label: '牙线使用频率',
                goodValues: ['daily'],
                badValues: ['never'],
                neutralValues: ['weekly', 'rarely']
            },
            {
                key: 'irrigatorUse',
                label: '冲牙器使用',
                goodValues: ['daily'],
                badValues: ['never'],
                neutralValues: ['weekly', 'rarely']
            }
        ];

        let improvingCount = 0, decliningCount = 0, stableCount = 0;
        const trackHtml = tracks.map(track => {
            const steps = submittedRecords.map((r, idx) => {
                const value = r.followupData?.[track.key];
                const label = this.getOptionLabel(track.key, value);
                const isLatest = idx === submittedRecords.length - 1;
                return `
                    <div class="trend-step ${isLatest ? 'latest' : ''}">
                        <div class="trend-step-date">${this.formatDate(r.date).slice(5)}</div>
                        <div class="trend-step-value">${label}</div>
                        <div class="trend-step-doctor">${r.doctor}</div>
                    </div>
                `;
            }).join('');

            let trendArrow = '';
            if (submittedRecords.length >= 2) {
                const firstVal = earliest.followupData?.[track.key];
                const lastVal = latest.followupData?.[track.key];
                if (track.goodValues.includes(lastVal) && track.badValues.includes(firstVal)) {
                    trendArrow = '<span class="trend-track-arrow up">↑ 改善</span>';
                    improvingCount++;
                } else if (track.badValues.includes(lastVal) && track.goodValues.includes(firstVal)) {
                    trendArrow = '<span class="trend-track-arrow down">↓ 变差</span>';
                    decliningCount++;
                } else if (firstVal === lastVal) {
                    trendArrow = '<span class="trend-track-arrow same">= 持平</span>';
                    stableCount++;
                } else {
                    trendArrow = '<span class="trend-track-arrow same">~ 波动</span>';
                    stableCount++;
                }
            }

            return `
                <div class="trend-track">
                    <div class="trend-track-label">
                        <span class="trend-track-title">${track.label}</span>
                        ${trendArrow}
                    </div>
                    <div class="trend-steps">
                        ${steps}
                    </div>
                </div>
            `;
        }).join('');

        const latestRecId = latest.conclusion?.recommendation;
        const earliestRecId = earliest.conclusion?.recommendation;
        const homecareLike = ['homecare'];
        const seriousLike = ['scaling', 'refer'];

        let overallTrendClass = 'trend-stable';
        let overallTrendText = '整体：病情稳定';
        let overallTrendIcon = '〰️';

        if (improvingCount > decliningCount) {
            overallTrendClass = 'trend-improving';
            overallTrendText = '整体：维护效果好转';
            overallTrendIcon = '📈';
        } else if (decliningCount > improvingCount) {
            overallTrendClass = 'trend-declining';
            overallTrendText = '整体：需要加强关注';
            overallTrendIcon = '📉';
        } else if (homecareLike.includes(latestRecId) && seriousLike.includes(earliestRecId)) {
            overallTrendClass = 'trend-improving';
            overallTrendText = '整体：治疗建议降级（好转）';
            overallTrendIcon = '📈';
        } else if (seriousLike.includes(latestRecId) && homecareLike.includes(earliestRecId)) {
            overallTrendClass = 'trend-declining';
            overallTrendText = '整体：治疗建议升级（需干预）';
            overallTrendIcon = '📉';
        }

        const recSteps = submittedRecords.map((r, idx) => {
            const recTitle = this.getRecommendationTitle(r.conclusion?.recommendation);
            const visitLabel = visitOptions.find(v => v.value === r.conclusion?.visitInterval)?.label || '';
            const isLatest = idx === submittedRecords.length - 1;
            return `
                <div class="trend-step ${isLatest ? 'latest' : ''}">
                    <div class="trend-step-date">${this.formatDate(r.date).slice(5)}</div>
                    <div class="trend-step-value">${recTitle}</div>
                    <div class="trend-step-doctor">${visitLabel || r.doctor}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="trend-section">
                <div class="section-header section-header-with-actions">
                    <h3>维护效果趋势视图</h3>
                    <span class="section-badge">基于 ${submittedRecords.length} 次随访</span>
                </div>
                <div class="trend-chart-container">
                    <div class="trend-summary">
                        <span style="font-size:12px; color: var(--text-secondary);">纵向追踪维护效果变化</span>
                        <span class="trend-overall-badge ${overallTrendClass}">
                            ${overallTrendIcon} ${overallTrendText}
                        </span>
                    </div>
                    ${trackHtml}
                    <div class="trend-track">
                        <div class="trend-track-label">
                            <span class="trend-track-title">复诊建议演变</span>
                        </div>
                        <div class="trend-steps">
                            ${recSteps}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLastJudgmentBox(lastRecord) {
        const rec = recommendations.find(r => r.id === lastRecord.conclusion?.recommendation);
        const visit = visitOptions.find(v => v.value === lastRecord.conclusion?.visitInterval);
        const isSameDoctor = lastRecord.doctor === this.currentDoctor?.name;
        return `
            <div class="last-judgment-box">
                <div class="last-judgment-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                    </svg>
                    ${isSameDoctor ? '您的上次判断' : '上次医生判断（交接参考）'}
                    <span class="record-doctor-tag ${isSameDoctor ? 'current-doctor' : ''}" style="margin-left: auto;">
                        ${lastRecord.doctor} · ${this.formatDate(lastRecord.date)}
                    </span>
                </div>
                <div class="last-judgment-content">
                    <div><strong>建议：</strong>${rec?.title || '未选择'}</div>
                    ${visit ? `<div style="margin-top: 4px;"><strong>复诊：</strong>${visit.label}</div>` : ''}
                    ${lastRecord.conclusion?.note ? `<div style="margin-top: 4px;"><strong>备注：</strong>${lastRecord.conclusion.note}</div>` : ''}
                </div>
                <div class="last-judgment-meta">
                    ${isSameDoctor ? '您可以基于此判断继续调整本次结论' : '请结合病史参考前一位医生的判断进行续写'}
                </div>
            </div>
        `;
    }

    renderComparisonSection(allRecords) {
        const lastRecord = allRecords[allRecords.length - 1];
        const prevRecord = allRecords.length > 1 ? allRecords[allRecords.length - 2] : null;
        
        const comparisonItems = [
            { key: 'brushingMethod', label: '刷牙方式', options: followupQuestions.brushingMethod.options },
            { key: 'flossUse', label: '牙线/牙缝刷', options: followupQuestions.flossUse.options },
            { key: 'irrigatorUse', label: '冲牙器使用', options: followupQuestions.irrigatorUse.options },
            { key: 'bleedingChange', label: '出血变化', options: followupQuestions.bleedingChange.options },
            { key: 'gumCondition', label: '牙龈状况', options: followupQuestions.gumCondition.options, multi: true }
        ];

        const getVal = (opt, v, isM) => {
            if (!v) return '—';
            return isM ? v.map(x => (opt.find(o => o.value === x)?.label || x)).join('、') : (opt.find(o => o.value === v)?.label || '—');
        };

        const getBadge = (cur, prev, isM) => {
            if (!prev || prev === '—') return '';
            if (isM) {
                const cArr = Array.isArray(cur) ? cur : [];
                const pArr = Array.isArray(prev) ? prev : [];
                const bad = ['pus', 'loose', 'bleeding', 'red'];
                const cBad = cArr.filter(v => bad.includes(v)).length;
                const pBad = pArr.filter(v => bad.includes(v)).length;
                if ((cArr.includes('normal') && !pArr.includes('normal')) || (cBad < pBad)) 
                    return '<span class="change-badge up">↑好转</span>';
                if ((!cArr.includes('normal') && pArr.includes('normal')) || (cBad > pBad)) 
                    return '<span class="change-badge down">↓变差</span>';
                return '<span class="change-badge same">=相同</span>';
            }
            const imp = { improve: 4, slight: 3, same: 2, worse: 1, daily: 4, weekly: 3, rarely: 2, never: 1, twice: 3, once: 2, irregular: 1, bass: 4, electric: 3, vertical: 2, horizontal: 1, unclear: 0 };
            if (imp[cur] !== undefined && imp[prev] !== undefined) {
                if (imp[cur] > imp[prev]) return '<span class="change-badge up">↑进步</span>';
                if (imp[cur] < imp[prev]) return '<span class="change-badge down">↓退步</span>';
            }
            return '<span class="change-badge same">=相同</span>';
        };

        const rows = comparisonItems.map(item => {
            const isM = item.multi;
            const lastVal = isM ? lastRecord.followupData?.[item.key] : lastRecord.followupData?.[item.key];
            const lastLabel = getVal(item.options, lastVal, isM);
            const curVal = isM ? (this.followupData[item.key] || []) : this.followupData[item.key];
            const curLabel = getVal(item.options, curVal, isM);
            const prevRef = item.key === 'bleedingChange' 
                ? (prevRecord?.followupData?.bleedingChange)
                : lastVal;
            const badge = getBadge(curVal, prevRef, isM);

            return `
                <tr>
                    <td class="comparison-label">${item.label}</td>
                    <td class="comparison-value">${lastLabel}</td>
                    <td class="comparison-value col-current">
                        ${curLabel || '<span style="color: var(--text-tertiary);">待填写</span>'}
                        ${this.handoffChoice !== 'ask' ? badge : ''}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="detail-section comparison-section">
                <div class="section-header section-header-with-actions">
                    <h3>维护记录对比</h3>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="section-badge">${this.formatDate(lastRecord.date)} vs 本次</span>
                    </div>
                </div>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th style="width:110px;">项目</th>
                            <th>${lastRecord.doctor} · 上次</th>
                            <th class="col-current">${this.currentDoctor?.name} · 本次</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    renderHistorySection(p) {
        const historyItems = [
            ...(p.history || []).map(h => ({
                id: 'h_' + (h.date || Math.random()),
                type: 'visit',
                date: h.date,
                doctor: h.doctor,
                event: h.event,
                note: h.note,
                isVisit: true
            })),
            ...(p.followupRecords || []).map(r => ({
                id: r.id,
                type: r.status,
                date: r.date,
                doctor: r.doctor,
                event: r.status === 'draft' ? '随访草稿' : '随访记录',
                note: r.conclusion?.note || this.getFollowupSummary(r),
                isVisit: false,
                fullRecord: r
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        const filteredItems = historyItems.filter(h => {
            if (this.historyFilter === 'all') return true;
            if (this.historyFilter === 'submitted') return h.type === 'submitted' || h.type === 'draft';
            if (this.historyFilter === 'visit') return h.isVisit;
            return true;
        });

        const timelineHtml = filteredItems.map(h => {
            const isExpandable = !h.isVisit;
            const isExpanded = this.expandedRecordIds.has(h.id);
            const isDraft = h.type === 'draft';
            const isCurrentDoctor = h.doctor === this.currentDoctor?.name;

            let expandContent = '';
            if (isExpandable && isExpanded && h.fullRecord) {
                expandContent = this.renderExpandedRecord(h.fullRecord);
            }

            return `
                <div class="timeline-item ${isExpandable ? 'timeline-item-expandable' : ''}" 
                     ${isExpandable ? `onclick="event.stopPropagation(); app.toggleRecordExpand('${h.id}')"` : ''}>
                    <div class="timeline-dot" style="${isDraft ? 'background: var(--warning-color); border-color: var(--warning-color);' : ''}"></div>
                    ${isExpandable ? `
                        <div class="timeline-expand-header">
                            <div style="flex:1;">
                                <div class="timeline-date">
                                    ${this.formatDate(h.date)}
                                    ${isDraft ? '<span class="followup-record-status draft" style="margin-left:6px;">草稿</span>' : '<span class="followup-record-status submitted" style="margin-left:6px;">已提交</span>'}
                                    ${isCurrentDoctor ? '<span class="new-record-badge" style="margin-left:4px;">我</span>' : ''}
                                </div>
                                <div class="timeline-content">${h.event}</div>
                                <div class="timeline-doctor">
                                    <span class="record-doctor-tag ${isCurrentDoctor ? 'current-doctor' : ''}">
                                        ${h.doctor}
                                    </span>
                                    · ${h.note}
                                </div>
                            </div>
                            <svg class="timeline-expand-arrow ${isExpanded ? 'expanded' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </div>
                    ` : `
                        <div class="timeline-date">${this.formatDate(h.date)}</div>
                        <div class="timeline-content">${h.event}</div>
                        <div class="timeline-doctor">
                            <span class="record-doctor-tag ${isCurrentDoctor ? 'current-doctor' : ''}">
                                ${h.doctor}
                            </span>
                            · ${h.note}
                        </div>
                    `}
                    ${expandContent}
                </div>
            `;
        }).join('');

        return `
            <div class="detail-section">
                <div class="section-header section-header-with-actions">
                    <h3>历史时间线 <span style="font-size:11px; color:var(--text-tertiary); font-weight:400;">· 点击随访记录查看详情</span></h3>
                    <div class="history-filter">
                        <button class="history-filter-btn ${this.historyFilter === 'all' ? 'active' : ''}" onclick="app.setHistoryFilter('all', this)">全部</button>
                        <button class="history-filter-btn ${this.historyFilter === 'submitted' ? 'active' : ''}" onclick="app.setHistoryFilter('submitted', this)">随访</button>
                        <button class="history-filter-btn ${this.historyFilter === 'visit' ? 'active' : ''}" onclick="app.setHistoryFilter('visit', this)">就诊</button>
                    </div>
                </div>
                <div class="timeline">
                    ${timelineHtml || '<div style="text-align:center; padding:20px; color: var(--text-tertiary); font-size:12px;">暂无历史记录</div>'}
                </div>
            </div>
        `;
    }

    toggleRecordExpand(recordId) {
        if (this.expandedRecordIds.has(recordId)) {
            this.expandedRecordIds.delete(recordId);
        } else {
            this.expandedRecordIds.add(recordId);
        }
        this.renderDetailPanel();
    }

    renderExpandedRecord(record) {
        const fd = record.followupData || {};
        const cd = record.conclusion || {};
        const rec = recommendations.find(r => r.id === cd.recommendation);
        const visit = visitOptions.find(v => v.value === cd.visitInterval);
        const isDraft = record.status === 'draft';
        const isCurrentDoctor = record.doctor === this.currentDoctor?.name;

        const followupItems = [
            { label: '刷牙方式', value: this.getOptionLabel('brushingMethod', fd.brushingMethod) },
            { label: '刷牙频率', value: this.getOptionLabel('brushingFrequency', fd.brushingFrequency) },
            { label: '牙线/牙缝刷', value: this.getOptionLabel('flossUse', fd.flossUse) },
            { label: '冲牙器使用', value: this.getOptionLabel('irrigatorUse', fd.irrigatorUse) },
            { label: '出血变化', value: this.getOptionLabel('bleedingChange', fd.bleedingChange) },
            { label: '牙龈状况', value: this.getMultiOptionLabels('gumCondition', fd.gumCondition) }
        ];

        let actionsHtml = '';
        if (isDraft) {
            if (this.editingDraftId === record.id) {
                actionsHtml = `
                    <div class="expanded-actions">
                        <span style="font-size:11px; color:var(--success-color); align-self:center;">
                            <span class="record-saved-icon">✓</span>正在编辑此草稿
                        </span>
                        <button class="btn-mini btn-mini-warning" onclick="event.stopPropagation(); app.discardDraft()">
                            放弃草稿
                        </button>
                    </div>
                `;
            } else {
                actionsHtml = `
                    <div class="expanded-actions">
                        <button class="btn-mini btn-mini-primary" onclick="event.stopPropagation(); app.continueEditingDraft('${record.id}')">
                            ✏️ 继续编辑此草稿
                        </button>
                        <button class="btn-mini btn-mini-warning" onclick="event.stopPropagation(); app.deleteSpecificDraft('${record.id}')">
                            🗑️ 删除
                        </button>
                    </div>
                `;
            }
        }

        return `
            <div class="timeline-expanded-content" onclick="event.stopPropagation();">
                <div class="expanded-section-title">📝 随访回答记录</div>
                <div class="expanded-detail-grid">
                    ${followupItems.map(item => `
                        <div class="expanded-detail-item">
                            <span class="expanded-detail-label">${item.label}：</span>
                            <span class="expanded-detail-value">${item.value}</span>
                        </div>
                    `).join('')}
                </div>
                ${fd.note ? `
                    <div class="expanded-detail-item" style="grid-column: 1 / -1;">
                        <span class="expanded-detail-label">补充说明：</span>
                        <span class="expanded-detail-value">${fd.note}</span>
                    </div>
                ` : ''}

                <div class="expanded-section-title">🩺 复查结论</div>
                <div class="expanded-detail-grid">
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">下一步建议：</span>
                        <span class="expanded-detail-value"><strong>${rec?.title || '未选择'}</strong></span>
                    </div>
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">下次复诊：</span>
                        <span class="expanded-detail-value">${visit?.label || '未选择'}</span>
                    </div>
                </div>
                ${cd.note ? `
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">医生备注：</span>
                        <span class="expanded-detail-value">${cd.note}</span>
                    </div>
                ` : ''}

                <div class="expanded-section-title">👤 记录信息</div>
                <div class="expanded-detail-grid">
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">记录医生：</span>
                        <span class="expanded-detail-value">
                            ${record.doctor}
                            <span class="record-doctor-tag ${isCurrentDoctor ? 'current-doctor' : ''}" style="margin-left:4px;">
                                ${isCurrentDoctor ? '本人' : '其他医生'}
                            </span>
                        </span>
                    </div>
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">记录时间：</span>
                        <span class="expanded-detail-value">${this.formatDate(record.date)}</span>
                    </div>
                    <div class="expanded-detail-item">
                        <span class="expanded-detail-label">状态：</span>
                        <span class="expanded-detail-value">
                            ${isDraft ? '<span class="followup-record-status draft">草稿</span>' : '<span class="followup-record-status submitted">已提交</span>'}
                        </span>
                    </div>
                    ${record.submittedAt ? `
                        <div class="expanded-detail-item">
                            <span class="expanded-detail-label">提交时间：</span>
                            <span class="expanded-detail-value">${this.formatDateTime(record.submittedAt)}</span>
                        </div>
                    ` : ''}
                </div>

                ${actionsHtml}
            </div>
        `;
    }

    continueEditingDraft(draftId) {
        const pIndex = this.patients.findIndex(p => p.id === this.selectedPatient.id);
        if (pIndex === -1) return;
        const draftRecord = this.patients[pIndex].followupRecords?.find(r => r.id === draftId);
        if (!draftRecord) return;

        this.editingDraftId = draftId;
        this.handoffChoice = 'continue';
        this.followupData = { ...draftRecord.followupData };
        this.conclusionData = { ...draftRecord.conclusion };
        this.generateAIRecommendation();

        this.showToast('info', '载入草稿', `正在编辑 ${draftRecord.doctor} 于 ${this.formatDate(draftRecord.date)} 创建的草稿`);
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    deleteSpecificDraft(draftId) {
        const pIndex = this.patients.findIndex(p => p.id === this.selectedPatient.id);
        if (pIndex === -1) return;

        if (!confirm('确定删除这条草稿吗？删除后无法恢复。')) return;

        this.patients[pIndex].followupRecords = (this.patients[pIndex].followupRecords || [])
            .filter(r => r.id !== draftId);

        if (this.editingDraftId === draftId) {
            this.editingDraftId = null;
            this.followupData = {};
            this.conclusionData = {};
            this.aiRecommendation = null;
            this.aiApplied = false;
        }

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
        this.showToast('success', '已删除', '草稿已删除');
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
        this.updateSummaryText();
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

    generateFollowupSummary() {
        const p = this.selectedPatient;
        const fd = this.followupData;
        const cd = this.conclusionData;
        const ai = this.aiRecommendation;

        const lines = [];
        lines.push(`【牙周维护随访记录】`);
        lines.push(`患者：${p.name}（${p.gender}，${p.age}岁）`);
        lines.push(`编号：${p.id}`);
        lines.push(`日期：${this.formatDate(new Date())}`);
        lines.push(`记录医生：${this.currentDoctor?.name}（${this.currentDoctor?.role}）`);
        lines.push('');

        lines.push(`— 患者回答 —`);
        if (fd.brushingMethod) lines.push(`• 刷牙方式：${this.getOptionLabel('brushingMethod', fd.brushingMethod)}`);
        if (fd.brushingFrequency) lines.push(`• 刷牙频率：${this.getOptionLabel('brushingFrequency', fd.brushingFrequency)}`);
        if (fd.flossUse) lines.push(`• 牙线/牙缝刷：${this.getOptionLabel('flossUse', fd.flossUse)}`);
        if (fd.irrigatorUse) lines.push(`• 冲牙器使用：${this.getOptionLabel('irrigatorUse', fd.irrigatorUse)}`);
        if (fd.bleedingChange) lines.push(`• 出血变化：${this.getOptionLabel('bleedingChange', fd.bleedingChange)}`);
        if (fd.gumCondition && fd.gumCondition.length > 0) {
            lines.push(`• 牙龈状况：${this.getMultiOptionLabels('gumCondition', fd.gumCondition)}`);
        }
        if (fd.note) lines.push(`• 补充说明：${fd.note}`);
        lines.push('');

        if (ai && ai.reasons.length > 0) {
            lines.push(`— 推荐理由 —`);
            const div = document.createElement('div');
            ai.reasons.forEach(r => {
                div.innerHTML = r;
                lines.push(`• ${div.textContent || r}`);
            });
            lines.push(`（AI置信度：${ai.confidence}%）`);
            lines.push('');
        }

        lines.push(`— 复查结论 —`);
        if (cd.recommendation) {
            lines.push(`• 下一步建议：${this.getRecommendationTitle(cd.recommendation)}`);
        }
        if (cd.visitInterval) {
            const visit = visitOptions.find(v => v.value === cd.visitInterval);
            lines.push(`• 下次复诊：${visit?.label || cd.visitInterval}`);
        }
        if (cd.note) lines.push(`• 医生备注：${cd.note}`);
        lines.push('');

        lines.push(`记录医师：${this.currentDoctor?.name}`);
        lines.push(`记录时间：${this.formatDateTime(new Date())}`);

        return lines.join('\n');
    }

    copySummaryToClipboard() {
        const text = this.generateFollowupSummary();
        const textarea = document.getElementById('summaryTextarea');
        if (!textarea) return;

        textarea.select();
        textarea.setSelectionRange(0, 99999);

        const copyBtn = document.getElementById('copyBtn');
        try {
            navigator.clipboard.writeText(text).then(() => {
                if (copyBtn) {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = '✓ 已复制';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = '📋 复制到剪贴板';
                    }, 2000);
                }
                this.showToast('success', '已复制', '随访小结已复制到剪贴板，可粘贴到病历系统');
            }).catch(() => {
                document.execCommand('copy');
                this.showToast('success', '已复制', '随访小结已复制到剪贴板');
            });
        } catch (e) {
            document.execCommand('copy');
            this.showToast('success', '已复制', '随访小结已复制到剪贴板');
        }
    }

    renderConclusionPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('conclusionContent');
        const statusEl = document.getElementById('statusIndicator');

        const hasConclusion = this.conclusionData.recommendation || this.conclusionData.visitInterval;
        const records = p.followupRecords || [];
        const submittedCount = records.filter(r => r.status === 'submitted').length;
        const editingDraft = this.editingDraftId
            ? records.find(r => r.id === this.editingDraftId)
            : null;
        const otherDrafts = records.filter(r => r.status === 'draft' && r.doctor !== this.currentDoctor?.name);
        const latestOtherDraft = otherDrafts.length > 0
            ? otherDrafts.sort((a,b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date))[0]
            : null;

        if (this.handoffChoice === 'ask') {
            contentEl.innerHTML = `
                <div style="padding:40px 20px; text-align:center;">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px; opacity:0.5; margin-bottom:12px;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <p style="font-size:14px; color:var(--text-secondary); margin-bottom:8px;">
                        请先在左侧选择草稿处理方式
                    </p>
                    <p style="font-size:12px; color:var(--text-tertiary);">
                        该患者有 ${latestOtherDraft?.doctor || '其他医生'} 未完成的草稿
                    </p>
                </div>
            `;
            statusEl.textContent = '等待交接';
            statusEl.className = 'status-indicator status-pending';
            return;
        }

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

        const summaryText = this.generateFollowupSummary();
        const hasSummaryContent = Object.keys(this.followupData).length > 0 || 
                                Object.keys(this.conclusionData).length > 0;

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

            ${hasSummaryContent ? `
            <div class="summary-box">
                <div class="summary-header">
                    <span class="summary-title">
                        📄 随访小结（可复制到病历系统）
                    </span>
                    <button class="copy-btn" id="copyBtn" onclick="app.copySummaryToClipboard()">
                        📋 复制到剪贴板
                    </button>
                </div>
                <textarea class="summary-textarea" id="summaryTextarea" readonly>${summaryText}</textarea>
            </div>
            ` : ''}

            <div class="doctor-signature">
                <div class="signature-info">
                    <div>
                        接诊医生：<strong>${this.currentDoctor?.name}</strong>
                        <span class="record-doctor-tag current-doctor" style="margin-left:6px;">
                            ${this.currentDoctor?.role}
                        </span>
                        ${this.editingDraftId && editingDraft && editingDraft.doctor !== this.currentDoctor?.name ? 
                            '<span class="continue-hint" style="margin-left:6px;">跨医生续写</span>' : ''}
                    </div>
                    <div>记录日期：${this.formatDate(new Date())}</div>
                    ${submittedCount > 0 ? `
                        <div style="margin-top:4px;">既往随访：${submittedCount} 条记录</div>
                    ` : ''}
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="app.saveDraft()">
                    ${this.editingDraftId ? '更新草稿' : '保存草稿'}
                </button>
                <button class="btn btn-primary" onclick="app.submitConclusion()">
                    提交结论
                </button>
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
        this.updateSummaryText();
    }

    updateSummaryText() {
        const textarea = document.getElementById('summaryTextarea');
        if (textarea) {
            textarea.value = this.generateFollowupSummary();
        }
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

        let draftIdx = -1;
        if (this.editingDraftId) {
            draftIdx = this.patients[pIndex].followupRecords.findIndex(r => r.id === this.editingDraftId);
        } else {
            draftIdx = this.patients[pIndex].followupRecords.findIndex(
                r => r.status === 'draft' && r.doctor === this.currentDoctor?.name
            );
        }

        const existingId = draftIdx > -1 ? this.patients[pIndex].followupRecords[draftIdx].id : null;
        const draftRecord = {
            id: existingId || ('FU' + Date.now()),
            date: this.formatDate(new Date()),
            doctor: this.currentDoctor?.name || '未知医生',
            doctorRole: this.currentDoctor?.role || '',
            followupData: JSON.parse(JSON.stringify(this.followupData)),
            conclusion: JSON.parse(JSON.stringify(this.conclusionData)),
            status: 'draft',
            updatedAt: new Date().toISOString()
        };

        if (draftIdx > -1) {
            this.patients[pIndex].followupRecords[draftIdx] = draftRecord;
        } else {
            this.patients[pIndex].followupRecords.push(draftRecord);
        }

        this.editingDraftId = draftRecord.id;
        this.selectedPatient = this.patients[pIndex];

        this.saveToStorage();
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
        this.showToast('success', this.editingDraftId ? '草稿已更新' : '草稿已保存', 
            `记录人：${this.currentDoctor?.name}，刷新页面后仍可继续编辑`);
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

        let draftIdx = -1;
        if (this.editingDraftId) {
            draftIdx = this.patients[pIndex].followupRecords.findIndex(r => r.id === this.editingDraftId);
        } else {
            draftIdx = this.patients[pIndex].followupRecords.findIndex(
                r => r.status === 'draft' && r.doctor === this.currentDoctor?.name
            );
        }

        const existingId = draftIdx > -1 ? this.patients[pIndex].followupRecords[draftIdx].id : null;
        const finalRecord = {
            id: existingId || ('FU' + Date.now()),
            date: this.formatDate(new Date()),
            doctor: this.currentDoctor?.name || '未知医生',
            doctorRole: this.currentDoctor?.role || '',
            followupData: JSON.parse(JSON.stringify(this.followupData)),
            conclusion: JSON.parse(JSON.stringify(this.conclusionData)),
            status: 'submitted',
            submittedAt: new Date().toISOString()
        };

        if (draftIdx > -1) {
            this.patients[pIndex].followupRecords[draftIdx] = finalRecord;
        } else {
            this.patients[pIndex].followupRecords.push(finalRecord);
        }

        this.patients[pIndex].lastVisit = finalRecord.date;

        this.selectedPatient = this.patients[pIndex];
        this.editingDraftId = null;
        this.followupData = {};
        this.conclusionData = {};
        this.aiRecommendation = null;
        this.aiApplied = false;
        this.expandedRecordIds = new Set();

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
        if (this.selectedPatientId) {
            this.selectedPatient = this.patients.find(p => p.id === this.selectedPatientId);
        }
        this.renderDoctorSelector();
        this.renderPatientList();
        if (this.selectedPatient) {
            this.renderDetailPanel();
            this.renderConclusionPanel();
        }
        this.updateFooterStats();
        this.updateNotificationCount();
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

        const todayCountEl = document.getElementById('todayCount');
        const pendingCountEl = document.getElementById('pendingCount');
        const totalRecordsEl = document.getElementById('totalRecords');

        if (todayCountEl) todayCountEl.textContent = todayPatients;
        if (pendingCountEl) pendingCountEl.textContent = pendingPatients;
        if (totalRecordsEl) totalRecordsEl.textContent = totalRecords;
    }

    formatDate(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
    }

    formatDateTime(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return this.formatDate(d) + ' ' + 
            String(d.getHours()).padStart(2, '0') + ':' + 
            String(d.getMinutes()).padStart(2, '0');
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
