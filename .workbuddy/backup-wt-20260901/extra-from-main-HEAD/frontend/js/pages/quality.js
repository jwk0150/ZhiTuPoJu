// ============== Quality View ==============
window.initQuality = function() {
    ['chart-accuracy','chart-error'].forEach(window.disposeChart);
    window.chartInstances['chart-accuracy'] = window.safeChart('chart-accuracy');
    window.chartInstances['chart-accuracy'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['JD解析','简历提取','匹配准确率','目标线'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:['7/1','7/3','7/5','7/7','7/9','7/11','7/13','7/15','7/17','7/19'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',min:80,max:100,axisLabel:{color:'#475569', fontSize:11, formatter:'{value}%'},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'JD解析',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#0D9488'},itemStyle:{color:'#0D9488'},data:[89.2,89.8,90.5,90.8,91.2,91.5,92.1,92.5,92.8,93.2]},
            {name:'简历提取',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#2DD4BF'},itemStyle:{color:'#2DD4BF'},data:[87.5,88.2,88.8,89.5,89.8,90.2,90.5,91.0,91.4,91.7]},
            {name:'匹配准确率',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#10b981'},itemStyle:{color:'#10b981'},data:[90.2,90.8,91.2,91.5,91.8,92.4,92.8,93.2,93.5,93.7]},
            {name:'目标线',type:'line',symbol:'none',lineStyle:{width:2, color:'#ef4444', type:'dashed'},itemStyle:{color:'#ef4444'},data:[90,90,90,90,90,90,90,90,90,90]}
        ]
    });
    window.chartInstances['chart-error'] = window.safeChart('chart-error');
    window.chartInstances['chart-error'].setOption({
        textStyle:{fontFamily:'DM Sans', color:'#475569'},
        tooltip:{trigger:'item', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        legend:{orient:'vertical', right:0, top:'center', textStyle:{color:'#475569', fontSize:11}, itemWidth:8, itemHeight:8},
        series:[{type:'pie',radius:['45%','75%'],center:['38%','50%'],itemStyle:{borderRadius:6,borderColor:'#fff',borderWidth:3},label:{show:false},labelLine:{show:false},data:[
            {value:32,name:'技能抽取遗漏',itemStyle:{color:'#0D9488'}},
            {value:24,name:'经验年限误判',itemStyle:{color:'#2DD4BF'}},
            {value:18,name:'学历匹配错误',itemStyle:{color:'#134E4A'}},
            {value:14,name:'职位名称歧义',itemStyle:{color:'#f72585'}},
            {value:8,name:'公司名实体错误',itemStyle:{color:'#f59e0b'}},
            {value:4,name:'其他',itemStyle:{color:'#ef4444'}}
        ]}]
    });
};


