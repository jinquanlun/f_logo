/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
Command: npx gltfjsx@6.5.3 Scenes_B_0023.glb --transform 
Files: Scenes_B_0023.glb [280.01MB] > /Users/quan/cursor/fellou_v1/Scenes_B_0023-transformed.glb [5.38MB] (98%)
*/

import React from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'

export function Model(props) {
  const group = React.useRef()
  const { nodes, materials, animations } = useGLTF('/Scenes_B_0023-transformed.glb')
  const { actions } = useAnimations(animations, group)
  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Scenes_B_0023" position={[11.171, 3.182, 11.142]} rotation={[-1.132, -0.089, -2.546]} scale={0.039}>
          <mesh name="網格002" geometry={nodes.網格002.geometry} material={materials.PaletteMaterial001} />
          <mesh name="網格002_1" geometry={nodes.網格002_1.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_2" geometry={nodes.網格002_2.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_3" geometry={nodes.網格002_3.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_4" geometry={nodes.網格002_4.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_5" geometry={nodes.網格002_5.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_6" geometry={nodes.網格002_6.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_7" geometry={nodes.網格002_7.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_8" geometry={nodes.網格002_8.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格002_9" geometry={nodes.網格002_9.geometry} material={materials.PaletteMaterial002} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/Scenes_B_0023-transformed.glb')
