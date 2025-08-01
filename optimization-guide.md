# 模型优化指南

## 🚀 快速优化方案

### 方法1：在线工具优化（推荐）

1. **访问 [meshopt.org](https://meshopt.org/)**
2. **上传你的模型**: `LOST_cut2_v5-transformed.glb`
3. **设置参数**:
   - Simplification ratio: `0.013` (保留1.3%，约12万顶点)
   - Preserve UVs: ✅ 勾选
   - Preserve normals: ✅ 勾选
   - Keep animations: ✅ 勾选
4. **点击 "Optimize"**
5. **下载优化后的文件**

### 方法2：Blender优化

1. 打开Blender
2. 导入 `LOST_cut2_v5-transformed.glb`
3. 选择所有网格对象
4. 添加 "Decimate" 修改器
5. 设置比例为 0.013
6. 应用修改器
7. 导出为GLB，启用DRACO压缩

## 🔧 预期结果

- 从 953万顶点 → 约12万顶点
- 保持环形形状不变
- 保持动画数据
- 文件大小进一步减小