/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
Command: npx gltfjsx@6.5.3 Scenes_B_00100.001.glb --transform 
Files: Scenes_B_00100.001.glb [279.95MB] > /Users/quan/cursor/fellou_v1/Scenes_B_00100.001-transformed.glb [5.39MB] (98%)
*/

import React from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'

export function Model(props) {
  const group = React.useRef()
  const { nodes, materials, animations } = useGLTF('/Scenes_B_00100.001-transformed.glb')
  const { actions } = useAnimations(animations, group)
  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Scenes_B_00100001" position={[0.609, 0.7, 6.831]} rotation={[-0.024, 0, 2.269]} scale={[0.026, 0.026, 0.016]}>
          <mesh name="網格001" geometry={nodes.網格001.geometry} material={materials.PaletteMaterial001} />
          <mesh name="網格001_1" geometry={nodes.網格001_1.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_2" geometry={nodes.網格001_2.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_3" geometry={nodes.網格001_3.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_4" geometry={nodes.網格001_4.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_5" geometry={nodes.網格001_5.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_6" geometry={nodes.網格001_6.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_7" geometry={nodes.網格001_7.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_8" geometry={nodes.網格001_8.geometry} material={materials.PaletteMaterial002} />
          <mesh name="網格001_9" geometry={nodes.網格001_9.geometry} material={materials.PaletteMaterial002} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/Scenes_B_00100.001-transformed.glb')
