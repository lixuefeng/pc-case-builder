import { useCallback } from "react";
import * as THREE from "three";
import { useToast } from "../context/ToastContext";
import { duplicateObject } from "../utils/objectUtils";

export function useSelection({ objects, setObjects, selectedIds, setSelectedIds }) {
    const { showToast } = useToast();

    const select = useCallback((id, multi = false) => {
        if (id === null) {
            setSelectedIds([]);
            return;
        }
        if (multi) {
            setSelectedIds((prev) => {
                if (prev.includes(id)) {
                    return prev.filter((i) => i !== id);
                } else {
                    return [...prev, id];
                }
            });
        } else {
            setSelectedIds([id]);
        }
    }, [setSelectedIds]);

    const handleGroup = useCallback(() => {
        if (selectedIds.length <= 1) return;

        const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

        const box = new THREE.Box3();
        selectedObjects.forEach((obj) => {
            const { w, d, h } = obj.dims;
            const pos = new THREE.Vector3(...obj.pos);
            const objBox = new THREE.Box3().setFromCenterAndSize(
                pos,
                new THREE.Vector3(w, h, d)
            );
            box.union(objBox);
        });

        const center = new THREE.Vector3();
        box.getCenter(center);

        const size = new THREE.Vector3();
        box.getSize(size);

        const newGroup = {
            id: `group_${Date.now()}`,
            type: "group",
            name: "新建编组",
            pos: center.toArray(),
            rot: [0, 0, 0],
            dims: { w: size.x, h: size.y, d: size.z },
            children: selectedObjects.map((obj) => ({
                ...obj,
                pos: [obj.pos[0] - center.x, obj.pos[1] - center.y, obj.pos[2] - center.z],
            })),
            visible: true,
            includeInExport: true,
            meta: {},
        };

        setObjects((prev) => [...prev.filter((o) => !selectedIds.includes(o.id)), newGroup]);
        setSelectedIds([newGroup.id]);
    }, [objects, selectedIds, setObjects, setSelectedIds]);

    const handleUngroup = useCallback(() => {
        const lastSelectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
        const group = objects.find((o) => o.id === lastSelectedId && o.type === "group");
        if (!group) return;

        const groupPos = new THREE.Vector3(...group.pos);
        const groupRot = new THREE.Euler(...(group.rot || [0, 0, 0]));
        const groupQuat = new THREE.Quaternion().setFromEuler(groupRot);

        const children = group.children.map((child) => {
            const childPos = new THREE.Vector3(...child.pos);
            const childRot = new THREE.Euler(...(child.rot || [0, 0, 0]));
            const childQuat = new THREE.Quaternion().setFromEuler(childRot);

            const worldPos = childPos.applyQuaternion(groupQuat).add(groupPos);
            const worldQuat = groupQuat.multiply(childQuat);
            const worldEuler = new THREE.Euler().setFromQuaternion(worldQuat);

            return {
                ...child,
                pos: worldPos.toArray(),
                rot: [worldEuler.x, worldEuler.y, worldEuler.z],
            };
        });

        setObjects((prev) => [...prev.filter((o) => o.id !== group.id), ...children]);
        setSelectedIds(children.map((c) => c.id));
    }, [objects, selectedIds, setObjects, setSelectedIds]);

    const handleDuplicate = useCallback(
        (ids) => {
            const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : selectedIds;
            const uniqueIds = Array.from(new Set(targetIds));
            if (uniqueIds.length === 0) {
                return;
            }

            const nextSelection = [];
            setObjects((prev) => {
                const clones = [];
                uniqueIds.forEach((id, index) => {
                    const original = prev.find((obj) => obj.id === id);
                    if (!original) {
                        return;
                    }
                    const duplicate = duplicateObject(original, index + 1);
                    if (!duplicate) {
                        return;
                    }
                    clones.push(duplicate);
                    nextSelection.push(duplicate.id);
                });
                if (clones.length === 0) {
                    return prev;
                }
                return [...prev, ...clones];
            });

            if (nextSelection.length > 0) {
                setSelectedIds(nextSelection);
                showToast({
                    type: "success",
                    text: `已复制 ${nextSelection.length} 个零件`,
                    ttl: 1500,
                });
            }
        },
        [selectedIds, setObjects, setSelectedIds, showToast]
    );

    const handleDelete = useCallback(() => {
        if (selectedIds.length === 0) return;
        setObjects((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
        setSelectedIds([]);
    }, [selectedIds, setObjects, setSelectedIds]);

    return {
        select,
        handleGroup,
        handleUngroup,
        handleDuplicate,
        handleDelete,
    };
}
