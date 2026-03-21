<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import dagre from '@dagrejs/dagre'
import LeadershipNode from './LeadershipNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps<{
    nodes: Node[]
    edges: Edge[]
}>()

const layoutNodes = ref<Node[]>([])
const layoutEdges = ref<Edge[]>([])

const { fitView } = useVueFlow({ id: 'leadership-graph' })

function applyDagreLayout(nodes: Node[], edges: Edge[]) {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80, marginx: 20, marginy: 20 })

    for (const node of nodes) {
        g.setNode(node.id, { width: 200, height: 56 })
    }
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    return nodes.map(node => {
        const pos = g.node(node.id)
        return {
            ...node,
            position: { x: pos.x - 100, y: pos.y - 28 },
        }
    })
}

watch(
    () => [props.nodes, props.edges],
    async () => {
        if (!props.nodes.length) {
            layoutNodes.value = []
            layoutEdges.value = []
            return
        }
        layoutNodes.value = applyDagreLayout(props.nodes, props.edges)
        layoutEdges.value = [...props.edges]
        await nextTick()
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100)
    },
    { immediate: true, deep: true }
)
</script>

<template>
    <div class="w-full h-[500px] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        <VueFlow
            v-if="layoutNodes.length"
            id="leadership-graph"
            :nodes="layoutNodes"
            :edges="layoutEdges"
            :default-edge-options="{ type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 1.5 }, animated: false }"
            :nodes-draggable="false"
            :nodes-connectable="false"
            :zoom-on-scroll="true"
            :pan-on-scroll="true"
            fit-view-on-init
            class="vue-flow-leadership"
        >
            <template #node-leadership="nodeProps">
                <LeadershipNode :data="nodeProps.data" />
            </template>
        </VueFlow>
        <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
            No hierarchy data to display
        </div>
    </div>
</template>

<style>
.vue-flow-leadership .vue-flow__edge-path {
    stroke: #cbd5e1;
    stroke-width: 1.5;
}
.vue-flow-leadership .vue-flow__background {
    background-color: #f9fafb;
}
.vue-flow-leadership .vue-flow__controls {
    display: none;
}
</style>
