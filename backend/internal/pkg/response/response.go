package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{Success: true, Data: data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{Success: true, Data: data})
}

func BadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, APIResponse{
		Success: false,
		Error:   &APIError{Code: "BAD_REQUEST", Message: msg},
	})
}

func Unauthorized(c *gin.Context, msg string) {
	c.JSON(http.StatusUnauthorized, APIResponse{
		Success: false,
		Error:   &APIError{Code: "UNAUTHORIZED", Message: msg},
	})
}

func Forbidden(c *gin.Context, msg string) {
	c.JSON(http.StatusForbidden, APIResponse{
		Success: false,
		Error:   &APIError{Code: "FORBIDDEN", Message: msg},
	})
}

func NotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, APIResponse{
		Success: false,
		Error:   &APIError{Code: "NOT_FOUND", Message: msg},
	})
}

func InternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, APIResponse{
		Success: false,
		Error:   &APIError{Code: "INTERNAL_ERROR", Message: msg},
	})
}
