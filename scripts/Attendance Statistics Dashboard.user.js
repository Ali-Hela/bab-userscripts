// ==UserScript==
// @name         Attendance Statistics Dashboard
// @namespace    http://tampermonkey.net/
// @version      2025-11-04
// @description  Adds integrated statistics widgets for attendance tracking with monthly hours, graphs, and progress tracking
// @author       You
// @match        https://smart.bab-albahrain.com/sys2026/attendance_list.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bab-albahrain.com
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('Attendance Dashboard Script Starting...');

    // Configuration
    const EXPECTED_HOURS_PER_DAY = 8; // 8 AM to 4 PM = 8 hours
    const WORKING_DAYS_PER_WEEK = 5; // Sunday to Thursday
    const WORK_START_TIME = 8; // 8 AM
    const WORK_END_TIME = 16; // 4 PM (16:00)
    const LATE_THRESHOLD_MINUTES = 5; // Consider late if more than 5 minutes after start time

    // Helper function to parse attendance data from the table
    function parseAttendanceData() {
        const rows = document.querySelectorAll('#form_grid_1 tbody tr.r-gridrow');
        const attendanceRecords = [];

        console.log('Found rows:', rows.length);

        rows.forEach((row, index) => {
            try {
                // Look for spans with val attributes which contain the actual data
                const dateSpan = row.querySelector('[data-field="Attendance_date_added"] span[val]');
                const timeInSpan = row.querySelector('[data-field="Attendance_in_datetime"] span[val]');
                const timeOutSpan = row.querySelector('[data-field="Attendance_out_datetime"] span[val]');
                const totalSpan = row.querySelector('[data-field="Attendance_total"] span[val]');

                if (index < 5) {
                    console.log(`Row ${index}:`);
                    console.log('  Date span:', dateSpan);
                    console.log('  Date val:', dateSpan?.getAttribute('val'));
                    console.log('  Time in val:', timeInSpan?.getAttribute('val'));
                    console.log('  Time out val:', timeOutSpan?.getAttribute('val'));
                    console.log('  Total val:', totalSpan?.getAttribute('val'));
                }

                if (!dateSpan || !timeInSpan) {
                    if (index < 5) console.log('  Skipping - missing dateSpan or timeInSpan');
                    return;
                }

                const dateVal = dateSpan.getAttribute('val'); // e.g., "2025-10-30 07:42:50" or "2025-11-03 08:33:23"
                const timeInVal = timeInSpan.getAttribute('val'); // e.g., "2025-10-30 07:42:50"
                const timeOutVal = timeOutSpan?.getAttribute('val'); // e.g., "2025-10-30 16:43:03"
                const totalVal = totalSpan?.getAttribute('val'); // e.g., "09:00:13" or "08:08:11"

                if (!totalVal) {
                    if (index < 5) console.log('  Skipping - no totalVal');
                    return;
                }

                // Extract date
                const date = dateVal.split(' ')[0]; // "2025-10-30" or "2025-11-03"

                // Extract hours worked from total (format: HH:MM:SS)
                let hoursWorked = 0;
                const timeParts = totalVal.split(':');
                if (timeParts.length >= 2) {
                    const hours = parseInt(timeParts[0]);
                    const minutes = parseInt(timeParts[1]);
                    hoursWorked = hours + (minutes / 60);
                }

                if (hoursWorked > 0) {
                    const record = {
                        date: date,
                        timeIn: timeInVal ? timeInVal.split(' ')[1] : '',
                        timeOut: timeOutVal ? timeOutVal.split(' ')[1] : '',
                        hoursWorked: hoursWorked
                    };

                    attendanceRecords.push(record);

                    if (index < 5) {
                        console.log('  ✓ Added record:', record);
                    }
                } else {
                    if (index < 5) console.log('  Skipping - hoursWorked is 0');
                }
            } catch (e) {
                console.error(`Error parsing row ${index}:`, e);
            }
        });

        console.log('Total records parsed:', attendanceRecords.length);
        if (attendanceRecords.length > 0) {
            console.log('Sample records:', attendanceRecords.slice(0, 3));
        }
        return attendanceRecords;
    }

    // Calculate hours worked between two times
    function calculateHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return 0;

        try {
            const parseTime = (timeStr) => {
                const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                if (!match) return null;

                let hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const period = match[3]?.toUpperCase();

                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                return hours + minutes / 60;
            };

            const inTime = parseTime(timeIn);
            const outTime = parseTime(timeOut);

            if (inTime === null || outTime === null) return 0;

            let hours = outTime - inTime;
            if (hours < 0) hours += 24; // Handle overnight shifts

            return Math.max(0, hours);
        } catch (e) {
            return 0;
        }
    }

    // Calculate statistics for a given month
    function calculateMonthStats(records, year, month) {
        const monthRecords = records.filter(record => {
            const date = new Date(record.date);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        const totalHours = monthRecords.reduce((sum, record) => sum + record.hoursWorked, 0);
        const daysWorked = monthRecords.filter(r => r.hoursWorked > 0).length;

        // Calculate lateness statistics
        let lateDays = 0;
        let totalLateMinutes = 0;
        let earlyDays = 0;
        let totalEarlyMinutes = 0;
        let onTimeDays = 0;

        monthRecords.forEach(record => {
            if (record.timeIn) {
                const timeParts = record.timeIn.split(':');
                const hours = parseInt(timeParts[0]);
                const minutes = parseInt(timeParts[1]);
                const totalMinutes = hours * 60 + minutes;
                const expectedMinutes = WORK_START_TIME * 60;
                const difference = totalMinutes - expectedMinutes;

                if (difference > LATE_THRESHOLD_MINUTES) {
                    lateDays++;
                    totalLateMinutes += difference;
                } else if (difference < -LATE_THRESHOLD_MINUTES) {
                    earlyDays++;
                    totalEarlyMinutes += Math.abs(difference);
                } else {
                    onTimeDays++;
                }
            }
        });

        // Calculate overtime/undertime
        let overtimeDays = 0;
        let undertimeDays = 0;
        let totalOvertime = 0;
        let totalUndertime = 0;

        monthRecords.forEach(record => {
            const diff = record.hoursWorked - EXPECTED_HOURS_PER_DAY;
            if (diff > 0.1) { // More than 6 minutes overtime
                overtimeDays++;
                totalOvertime += diff;
            } else if (diff < -0.1) { // More than 6 minutes undertime
                undertimeDays++;
                totalUndertime += Math.abs(diff);
            }
        });

        // Calculate expected hours for the month
        // Work week is Sunday (0) to Thursday (4), excluding Friday (5) and Saturday (6)
        const now = new Date();
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
        const lastDay = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();

        let expectedDays = 0;
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            // Include Sunday (0), Monday (1), Tuesday (2), Wednesday (3), Thursday (4)
            // Exclude Friday (5) and Saturday (6)
            if (dayOfWeek !== 5 && dayOfWeek !== 6) expectedDays++;
        }

        const expectedHours = expectedDays * EXPECTED_HOURS_PER_DAY;
        const progress = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;
        const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;
        const avgLateMinutes = lateDays > 0 ? totalLateMinutes / lateDays : 0;
        const avgEarlyMinutes = earlyDays > 0 ? totalEarlyMinutes / earlyDays : 0;
        const punctualityRate = daysWorked > 0 ? (onTimeDays / daysWorked) * 100 : 0;

        return {
            totalHours: totalHours.toFixed(2),
            daysWorked,
            expectedHours: expectedHours.toFixed(2),
            progress: progress.toFixed(1),
            difference: (totalHours - expectedHours).toFixed(2),
            avgHoursPerDay: avgHoursPerDay.toFixed(2),
            lateDays,
            earlyDays,
            onTimeDays,
            avgLateMinutes: avgLateMinutes.toFixed(1),
            avgEarlyMinutes: avgEarlyMinutes.toFixed(1),
            punctualityRate: punctualityRate.toFixed(1),
            overtimeDays,
            undertimeDays,
            totalOvertime: totalOvertime.toFixed(2),
            totalUndertime: totalUndertime.toFixed(2),
            avgOvertime: overtimeDays > 0 ? (totalOvertime / overtimeDays).toFixed(2) : '0.00',
            avgUndertime: undertimeDays > 0 ? (totalUndertime / undertimeDays).toFixed(2) : '0.00'
        };
    }

    // Create statistics dashboard
    function createDashboard() {
        try {
            console.log('Creating dashboard...');
            const records = parseAttendanceData();

            console.log('Records found:', records.length);

            if (records.length === 0) {
                console.warn('No attendance records found - dashboard not created');
                // Create a debug panel to show what's happening
                const debugPanel = document.createElement('div');
                debugPanel.style.cssText = 'background: #fff3cd; border: 2px solid #856404; padding: 15px; margin: 20px; border-radius: 5px;';
                debugPanel.innerHTML = '<strong>Debug:</strong> No attendance records found. Check console for details.';
                const gridContainer = document.querySelector('.r-grid');
                if (gridContainer) {
                    gridContainer.parentNode.insertBefore(debugPanel, gridContainer);
                }
                return;
            }

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            const currentStats = calculateMonthStats(records, currentYear, currentMonth);
            const lastMonthStats = calculateMonthStats(records, lastMonthYear, lastMonth);

            console.log('Current month stats:', currentStats);
            console.log('Last month stats:', lastMonthStats);

            // Create dashboard container
            const dashboard = document.createElement('div');
            dashboard.id = 'attendance-dashboard';
        dashboard.innerHTML = `
            <style>
                #attendance-dashboard {
                    margin: 20px 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .stats-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .stat-card {
                    background: #fff;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .stat-card h3 {
                    margin: 0 0 15px 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #337ab7;
                    padding-bottom: 10px;
                }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                .stat-row:last-child {
                    border-bottom: none;
                }
                .stat-label {
                    color: #666;
                    font-size: 14px;
                }
                .stat-value {
                    font-weight: 600;
                    font-size: 14px;
                    color: #333;
                }
                .stat-value.positive {
                    color: #5cb85c;
                }
                .stat-value.negative {
                    color: #d9534f;
                }
                .progress-bar-container {
                    width: 100%;
                    height: 24px;
                    background: #f0f0f0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 10px 0;
                    position: relative;
                }
                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #5cb85c 0%, #4cae4c 100%);
                    transition: width 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 600;
                    font-size: 12px;
                }
                .progress-bar.over {
                    background: linear-gradient(90deg, #f0ad4e 0%, #ec971f 100%);
                }
                .chart-container {
                    background: #fff;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                .chart-container h3 {
                    margin: 0 0 15px 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }
                .date-range-controls {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                .date-range-controls label {
                    font-size: 14px;
                    color: #666;
                }
                .date-range-controls input {
                    padding: 6px 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .date-range-controls button {
                    padding: 6px 15px;
                    background: #337ab7;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .date-range-controls button:hover {
                    background: #286090;
                }
                canvas {
                    max-height: 300px;
                }
            </style>

            <div class="stats-container">
                <div class="stat-card">
                    <h3>Current Month (${getMonthName(currentMonth)} ${currentYear})</h3>
                    <div class="stat-row">
                        <span class="stat-label">Hours Worked:</span>
                        <span class="stat-value">${currentStats.totalHours} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Expected Hours:</span>
                        <span class="stat-value">${currentStats.expectedHours} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Difference:</span>
                        <span class="stat-value ${parseFloat(currentStats.difference) >= 0 ? 'positive' : 'negative'}">
                            ${parseFloat(currentStats.difference) >= 0 ? '+' : ''}${currentStats.difference} hrs
                        </span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Days Worked:</span>
                        <span class="stat-value">${currentStats.daysWorked} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Avg Hours/Day:</span>
                        <span class="stat-value">${currentStats.avgHoursPerDay} hrs</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${parseFloat(currentStats.progress) > 100 ? 'over' : ''}"
                             style="width: ${Math.min(parseFloat(currentStats.progress), 100)}%">
                            ${currentStats.progress}%
                        </div>
                    </div>
                </div>

                <div class="stat-card">
                    <h3>Last Month (${getMonthName(lastMonth)} ${lastMonthYear})</h3>
                    <div class="stat-row">
                        <span class="stat-label">Hours Worked:</span>
                        <span class="stat-value">${lastMonthStats.totalHours} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Expected Hours:</span>
                        <span class="stat-value">${lastMonthStats.expectedHours} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Difference:</span>
                        <span class="stat-value ${parseFloat(lastMonthStats.difference) >= 0 ? 'positive' : 'negative'}">
                            ${parseFloat(lastMonthStats.difference) >= 0 ? '+' : ''}${lastMonthStats.difference} hrs
                        </span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Days Worked:</span>
                        <span class="stat-value">${lastMonthStats.daysWorked} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Avg Hours/Day:</span>
                        <span class="stat-value">${lastMonthStats.avgHoursPerDay} hrs</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${parseFloat(lastMonthStats.progress) > 100 ? 'over' : ''}"
                             style="width: ${Math.min(parseFloat(lastMonthStats.progress), 100)}%">
                            ${lastMonthStats.progress}%
                        </div>
                    </div>
                </div>

                <div class="stat-card">
                    <h3>Punctuality (Current Month)</h3>
                    <div class="stat-row">
                        <span class="stat-label">On Time:</span>
                        <span class="stat-value positive">${currentStats.onTimeDays} days (${currentStats.punctualityRate}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Late Arrivals:</span>
                        <span class="stat-value ${currentStats.lateDays > 0 ? 'negative' : ''}">${currentStats.lateDays} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Avg Late By:</span>
                        <span class="stat-value">${currentStats.avgLateMinutes} min</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Early Arrivals:</span>
                        <span class="stat-value positive">${currentStats.earlyDays} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Avg Early By:</span>
                        <span class="stat-value">${currentStats.avgEarlyMinutes} min</span>
                    </div>
                </div>

                <div class="stat-card">
                    <h3>Overtime/Undertime (Current Month)</h3>
                    <div class="stat-row">
                        <span class="stat-label">Overtime Days:</span>
                        <span class="stat-value positive">${currentStats.overtimeDays} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Overtime:</span>
                        <span class="stat-value positive">+${currentStats.totalOvertime} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Avg Overtime/Day:</span>
                        <span class="stat-value">${currentStats.avgOvertime} hrs</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Undertime Days:</span>
                        <span class="stat-value ${currentStats.undertimeDays > 0 ? 'negative' : ''}">${currentStats.undertimeDays} days</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Undertime:</span>
                        <span class="stat-value ${currentStats.undertimeDays > 0 ? 'negative' : ''}">-${currentStats.totalUndertime} hrs</span>
                    </div>
                </div>
            </div>

            <div class="chart-container">
                <h3>Hours Worked Over Time</h3>
                <div class="date-range-controls">
                    <label>From:</label>
                    <input type="date" id="start-date" value="${getDefaultStartDate()}">
                    <label>To:</label>
                    <input type="date" id="end-date" value="${getDefaultEndDate()}">
                    <button id="update-chart">Update Chart</button>
                </div>
                <canvas id="attendance-chart"></canvas>
            </div>
        `;

        // Insert dashboard before the grid
        const gridContainer = document.querySelector('.r-grid');
        if (gridContainer) {
            console.log('Inserting dashboard into page...');
            gridContainer.parentNode.insertBefore(dashboard, gridContainer);

            // Initialize chart after a delay to ensure Chart.js is loaded
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    initializeChart(records);

                    // Add event listener for chart update
                    document.getElementById('update-chart').addEventListener('click', () => {
                        initializeChart(records);
                    });
                } else {
                    console.error('Chart.js not loaded!');
                }
            }, 500);
        } else {
            console.error('Could not find .r-grid container');
        }
        } catch (error) {
            console.error('Error creating dashboard:', error);
            // Show error on page
            const errorPanel = document.createElement('div');
            errorPanel.style.cssText = 'background: #f8d7da; border: 2px solid #721c24; padding: 15px; margin: 20px; border-radius: 5px; color: #721c24;';
            errorPanel.innerHTML = '<strong>Error:</strong> Failed to create dashboard. Check console for details.';
            const gridContainer = document.querySelector('.r-grid');
            if (gridContainer) {
                gridContainer.parentNode.insertBefore(errorPanel, gridContainer);
            }
        }
    }

    // Get month name
    function getMonthName(month) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[month];
    }

    // Get default date range (last 30 days)
    function getDefaultStartDate() {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }

    function getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }

    // Initialize Chart.js chart
    function initializeChart(records) {
        try {
            console.log('Initializing chart with', records.length, 'records');

            const startDate = new Date(document.getElementById('start-date').value);
            const endDate = new Date(document.getElementById('end-date').value);

            // Filter records by date range
            const filteredRecords = records.filter(record => {
                const date = new Date(record.date);
                return date >= startDate && date <= endDate;
            });

            console.log('Filtered to', filteredRecords.length, 'records for chart');

            // Group by date and sum hours
            const dailyData = {};
            filteredRecords.forEach(record => {
                const date = record.date;
                if (!dailyData[date]) {
                    dailyData[date] = 0;
                }
                dailyData[date] += record.hoursWorked;
            });

            // Sort dates and prepare chart data
            const sortedDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
            const labels = sortedDates.map(date => {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            const data = sortedDates.map(date => dailyData[date].toFixed(2));

            const ctx = document.getElementById('attendance-chart');

            // Destroy existing chart if it exists
            if (window.attendanceChart) {
                window.attendanceChart.destroy();
            }

            window.attendanceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Hours Worked',
                        data: data,
                        backgroundColor: 'rgba(51, 122, 183, 0.7)',
                        borderColor: 'rgba(51, 122, 183, 1)',
                        borderWidth: 1
                    }, {
                        label: 'Expected Hours',
                        data: Array(labels.length).fill(EXPECTED_HOURS_PER_DAY),
                        type: 'line',
                        borderColor: 'rgba(217, 83, 79, 0.8)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Hours'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        }
                    }
                }
            });

            console.log('Chart created successfully');
        } catch (error) {
            console.error('Error creating chart:', error);
        }
    }

    // Wait for page to load and create dashboard
    function init() {
        console.log('Initializing attendance dashboard...');
        console.log('Document ready state:', document.readyState);
        console.log('Chart.js available:', typeof Chart !== 'undefined');

        // Check if we need to click the "All" tab first
        const currentUrl = window.location.href;
        const allTabLink = document.querySelector('a[data-tabid="all"]');

        if (allTabLink && !currentUrl.includes('tab=all')) {
            console.log('Switching to "All" tab to load all records...');
            // Click the All tab
            allTabLink.click();
            // Wait for page to reload/update, then init
            setTimeout(() => {
                createDashboard();
            }, 2000);
        } else {
            // Wait a bit for the page to fully render
            setTimeout(() => {
                createDashboard();
            }, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();