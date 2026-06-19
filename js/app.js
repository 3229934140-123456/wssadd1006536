class PeriodontalApp {
    constructor() {
        this.patients = mockPatients;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.selectedPatient = null;
        this.followupData = {};
        this.conclusionData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPatientList();
        this.updateFooterStats();
        this.setCurrentDate();
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

        document.querySelector('.patient-queue .btn-icon').addEventListener('click', () => {
            this.refreshList();
        });
    }

    setCurrentDate() {
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0');
        document.getElementById('currentDate').textContent = dateStr;
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

        listEl.innerHTML = patients.map(patient => `
            <div class="patient-card ${this.selectedPatient?.id === patient.id ? 'active' : ''}" 
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
            </div>
        `).join('');
    }

    selectPatient(patientId) {
        this.selectedPatient = this.patients.find(p => p.id === patientId);
        this.followupData = {};
        this.conclusionData = {};
        this.renderPatientList();
        this.renderDetailPanel();
        this.renderConclusionPanel();
    }

    renderDetailPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('detailContent');

        document.getElementById('patientIdBadge').textContent = p.id;

        const plaqueClass = p.plaqueLevel === 'good' ? 'good' : p.plaqueLevel === 'moderate' ? 'moderate' : 'poor';
        const plaqueLabel = p.plaqueLevel === 'good' ? '良好' : p.plaqueLevel === 'moderate' ? '一般' : '较差';

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
                        <span class="info-value">${p.doctor}</span>
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

            <div class="detail-section">
                <div class="section-header">
                    <h3>历史记录</h3>
                </div>
                <div class="timeline">
                    ${p.history.map(h => `
                        <div class="timeline-item">
                            <div class="timeline-dot"></div>
                            <div class="timeline-date">${this.formatDate(h.date)}</div>
                            <div class="timeline-content">${h.event}</div>
                            <div class="timeline-doctor">${h.doctor} · ${h.note}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="detail-section">
                <div class="section-header">
                    <h3>本次随访记录</h3>
                    <span class="section-badge">结构化填写</span>
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
                                  onchange="app.updateFollowupNote(this.value)"
                                  id="followupNote">${this.followupData.note || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
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
        this.renderDetailPanel();
    }

    updateFollowupNote(value) {
        this.followupData.note = value;
    }

    renderConclusionPanel() {
        const p = this.selectedPatient;
        const contentEl = document.getElementById('conclusionContent');
        const statusEl = document.getElementById('statusIndicator');

        const hasConclusion = this.conclusionData.recommendation || this.conclusionData.visitInterval;
        if (hasConclusion) {
            statusEl.textContent = '已填写';
            statusEl.className = 'status-indicator status-completed';
        } else {
            statusEl.textContent = '待填写';
            statusEl.className = 'status-indicator status-pending';
        }

        contentEl.innerHTML = `
            <div class="detail-section">
                <div class="section-header">
                    <h3>下一步建议</h3>
                </div>
                <div class="recommendation-list">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item ${this.conclusionData.recommendation === rec.id ? 'selected' : ''}"
                             onclick="app.selectRecommendation('${rec.id}')">
                            <div class="recommendation-header">
                                <div class="recommendation-icon ${rec.iconClass}">${rec.icon}</div>
                                <div class="recommendation-title">${rec.title}</div>
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
                              onchange="app.updateConclusionNote(this.value)"
                              id="conclusionNote">${this.conclusionData.note || ''}</textarea>
                </div>
            </div>

            <div class="doctor-signature">
                <div class="signature-info">
                    <div>接诊医生：<strong>张医生</strong></div>
                    <div>记录日期：${this.formatDate(new Date())}</div>
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="app.saveDraft()">保存草稿</button>
                <button class="btn btn-primary" onclick="app.submitConclusion()">提交结论</button>
            </div>
        `;
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
        alert('草稿已保存！');
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

        const rec = recommendations.find(r => r.id === this.conclusionData.recommendation);
        const visit = visitOptions.find(v => v.value === this.conclusionData.visitInterval);
        
        alert(`复查结论已提交！\n\n患者：${this.selectedPatient.name}\n建议：${rec.title}\n复诊：${visit.label}`);
        
        const statusEl = document.getElementById('statusIndicator');
        statusEl.textContent = '已提交';
        statusEl.className = 'status-indicator status-completed';
    }

    refreshList() {
        this.renderPatientList();
    }

    updateFooterStats() {
        const today = new Date();
        const dateStr = today.getFullYear() + '-' + 
            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
            String(today.getDate()).padStart(2, '0');
        
        const todayPatients = this.patients.filter(p => p.lastVisit === dateStr).length;
        const pendingPatients = this.patients.filter(p => p.status === 'watch' || p.status === 'attention').length;

        document.getElementById('todayCount').textContent = todayPatients;
        document.getElementById('pendingCount').textContent = pendingPatients;
    }

    formatDate(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
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
