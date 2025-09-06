import { TaskList, Task } from './types';

export interface TasksResponse {
  success: boolean;
  error?: string;
  message?: string;
  taskLists?: TaskList[];
  tasks?: Task[];
  taskList?: TaskList;
  task?: Task;
}

export async function getTaskLists(): Promise<TasksResponse> {
  if (!(window as any).gapi.client.tasks) {
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: "Tasks API module not loaded." 
    };
  }

  try {
    const response = await (window as any).gapi.client.tasks.tasklists.list({
      maxResults: 100
    });

    const taskLists = response.result.items || [];
    return {
      success: true,
      taskLists: taskLists.map((list: any) => ({
        id: list.id,
        title: list.title
      })),
      message: `Found ${taskLists.length} task list(s).`
    };
  } catch (err: any) {
    const errorMessage = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Tasks auth error (${errorMessage}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to fetch task lists: ${errorMessage}` 
    };
  }
}

export async function getTasks(taskListId: string): Promise<TasksResponse> {
  if (!(window as any).gapi.client.tasks) {
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: "Tasks API module not loaded." 
    };
  }

  try {
    const response = await (window as any).gapi.client.tasks.tasks.list({
      tasklist: taskListId,
      showCompleted: true,
      showHidden: true
    });

    const tasks = response.result.items || [];
    return {
      success: true,
      tasks: tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        status: task.status,
        due: task.due,
        completed: task.completed,
        position: task.position,
        parent: task.parent
      })),
      message: `Found ${tasks.length} task(s).`
    };
  } catch (err: any) {
    const errorMessage = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Tasks auth error (${errorMessage}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to fetch tasks: ${errorMessage}` 
    };
  }
}

export async function createTask(
  taskListId: string,
  title: string,
  notes?: string,
  due?: string,
  parent?: string,
  previous?: string
): Promise<TasksResponse> {
  if (!(window as any).gapi.client.tasks) {
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: "Tasks API module not loaded." 
    };
  }

  try {
    const task = {
      title,
      notes,
      due,
      parent,
      previous
    };

    const response = await (window as any).gapi.client.tasks.tasks.insert({
      tasklist: taskListId,
      resource: task
    });

    return {
      success: true,
      task: {
        id: response.result.id,
        title: response.result.title,
        notes: response.result.notes,
        status: response.result.status,
        due: response.result.due,
        completed: response.result.completed,
        position: response.result.position,
        parent: response.result.parent
      },
      message: `Task "${title}" created successfully.`
    };
  } catch (err: any) {
    const errorMessage = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Tasks auth error (${errorMessage}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to create task: ${errorMessage}` 
    };
  }
}

export async function updateTask(
  taskListId: string,
  taskId: string,
  updates: {
    title?: string;
    notes?: string;
    status?: string;
    due?: string;
    completed?: string;
  }
): Promise<TasksResponse> {
  if (!(window as any).gapi.client.tasks) {
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: "Tasks API module not loaded." 
    };
  }

  try {
    console.log('updateTask called with:', { taskListId, taskId, updates });
    const response = await (window as any).gapi.client.tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      resource: updates
    });

    return {
      success: true,
      task: {
        id: response.result.id,
        title: response.result.title,
        notes: response.result.notes,
        status: response.result.status,
        due: response.result.due,
        completed: response.result.completed,
        position: response.result.position,
        parent: response.result.parent
      },
      message: `Task updated successfully.`
    };
  } catch (err: any) {
    const errorMessage = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Tasks auth error (${errorMessage}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to update task: ${errorMessage}` 
    };
  }
}

export async function deleteTask(taskListId: string, taskId: string): Promise<TasksResponse> {
  if (!(window as any).gapi.client.tasks) {
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: "Tasks API module not loaded." 
    };
  }

  try {
    await (window as any).gapi.client.tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId
    });

    return {
      success: true,
      message: "Task deleted successfully."
    };
  } catch (err: any) {
    const errorMessage = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Tasks auth error (${errorMessage}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to delete task: ${errorMessage}` 
    };
  }
} 